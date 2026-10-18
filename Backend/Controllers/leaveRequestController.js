const mongoose = require("mongoose");
const LeaveRequest = require("../Models/LeaveRequest");
const User = require("../Models/User");
const leaveHelper = require('../Middlewares/leaveCalculationHelper');
const Department = require("../Models/Department");
const { sendNotificationToUser, sendNotificationToRole } = require('../Middlewares/notificationService');
const { LEAVE_TYPES, REJECTED } = require('../constants/leave');
const { toCompanyDate, startOfDay, countWorkingDays } = require('../utils/time');
const policies = require('../services/policies');
const rules = require('../services/leaveRules');
const decisions = require('../services/leaveDecisions');
const { resolveApprover } = require('../services/approvers');

const formatRange = (request) =>
  `${new Date(request.startDate).toLocaleDateString()} to ${new Date(request.endDate).toLocaleDateString()}`;

const fullName = (user) => (user ? `${user.firstName} ${user.lastName}` : 'Unknown user');

const CREATED_BY = { employee: 'Employee', manager: 'Manager', admin: 'Admin' };

const hasOverlappingRequest = async (userId, startDate, endDate) => {
  const start = toCompanyDate(startDate);
  const end = toCompanyDate(endDate);

  const overlapping = await LeaveRequest.exists({
    employeeId: userId,
    startDate: { $lte: end },
    endDate: { $gte: start },
    status: { $nin: REJECTED }
  });
  return Boolean(overlapping);
};

exports.getApprover = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('role managerId');
    const approver = user ? await resolveApprover(user) : null;
    res.status(200).json({ approver });
  } catch (err) {
    console.error('Error resolving leave approver:', err);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

exports.getAllLeaveRequests = async (req, res) => {
  try {
    const userId = req.user.id;
    let filter;

    switch (req.user.role) {
      case 'manager':
        // Own requests plus requests assigned to this manager.
        filter = { $or: [{ employeeId: userId }, { managerId: userId }] };
        break;
      case 'admin':
      case 'superAdmin':
        filter = {};
        break;
      case 'employee':
        filter = { employeeId: userId };
        break;
      default:
        return res.status(403).json({ message: "Unauthorized role" });
    }

    const leaveRequests = await LeaveRequest.find(filter)
      .sort({ createdAt: -1 })
      .populate("employeeId", "firstName lastName email role")
      .populate("managerId", "firstName lastName email role")
      .lean();

    res.status(200).json(leaveRequests);
  } catch (err) {
    console.error(`Error fetching ${req.user.role} leave requests:`, err);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

exports.createLeaveRequest = async (req, res) => {
  const { startDate, endDate, reason } = req.body;
  const userId = req.user.id;

  try {
    const start = toCompanyDate(startDate);
    const end = toCompanyDate(endDate);
    if (!startDate || !endDate || isNaN(start) || isNaN(end)) {
      return res.status(400).json({ message: 'Valid start and end dates are required.' });
    }
    if (start > end) {
      return res.status(400).json({ message: 'The start date must be on or before the end date.' });
    }
    if (!LEAVE_TYPES.includes(reason)) {
      return res.status(400).json({ message: `Leave type must be one of: ${LEAVE_TYPES.join(', ')}.` });
    }

    const user = await User.findById(userId);
    if (!user || !CREATED_BY[user.role]) {
      return res.status(403).json({ message: "Unauthorized role" });
    }

    const approver = await resolveApprover(user);
    if (!approver) {
      return res.status(400).json({
        message: 'No approver is assigned to you. Please contact HR to be assigned a manager.'
      });
    }

    if (await hasOverlappingRequest(userId, start, end)) {
      return res.status(400).json({
        message: "You already have a leave request for this date range or part of it."
      });
    }

    const validation = await leaveHelper.validateLeaveRequest(userId, start, end);

    const leaveRequest = await LeaveRequest.create({
      employeeId: userId,
      managerId: approver._id,
      startDate: start,
      endDate: end,
      reason,
      status: "Pending",
      createdBy: CREATED_BY[user.role],
      history: [{ action: 'submitted', status: 'Pending', by: userId, byRole: user.role }]
    });

    const notification = {
      title: user.role === 'employee' ? 'New Leave Request' : `New Leave Request from ${user.role === 'manager' ? 'Manager' : 'Admin'}`,
      message: `${fullName(user)} has requested leave from ${formatRange(leaveRequest)}.`,
      type: 'leave_request',
      relatedId: leaveRequest._id
    };
    await sendNotificationToUser(approver._id, notification);
    if (user.role === 'employee') {
      // HR is kept informed of all employee requests.
      await sendNotificationToRole('admin', notification);
    }

    res.status(201).json({
      message: "Leave request submitted successfully",
      leaveRequest,
      approver,
      leaveBalance: {
        totalAccruedDays: validation.totalAccruedDays,
        daysTaken: validation.daysTaken,
        remainingDays: validation.remainingDays,
        daysRequested: validation.daysRequested
      }
    });
  } catch (err) {
    if (err instanceof leaveHelper.LeaveValidationError) {
      return res.status(400).json({ message: err.message });
    }
    console.error("Error creating leave request:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// --- Decisions ------------------------------------------------------------------
// One handler for every reviewer: the role rules live in services/policies.js
// and the state changes (with the undo window) in services/leaveDecisions.js.

const sendError = (res, error, context) => {
  if (error instanceof decisions.DecisionError) return res.status(error.status).json({ message: error.message });
  console.error(`Error in ${context}:`, error);
  return res.status(500).json({ message: 'Server error' });
};

const findRequest = async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    res.status(404).json({ message: 'Leave request not found' });
    return null;
  }
  const request = await LeaveRequest.findById(req.params.id);
  if (!request) res.status(404).json({ message: 'Leave request not found' });
  return request;
};

const DECISION_MESSAGES = {
  manager: { approve: 'Request approved by manager', reject: 'Request rejected by manager' },
  admin: { approve: 'Request approved by admin', reject: 'Request rejected by admin' },
  superAdmin: { approve: 'Request approved by CEO', reject: 'Request rejected by CEO' },
};

const decisionHandler = (action) => async (req, res) => {
  try {
    const request = await findRequest(req, res);
    if (!request) return;
    const updated = await decisions.decide({ request, user: req.user, action, note: req.body?.note });
    res.status(200).json({
      message: DECISION_MESSAGES[req.user.role][action],
      request: updated,
      undoUntil: updated.decision.undoUntil,
    });
  } catch (error) {
    sendError(res, error, `${action} leave request`);
  }
};

// Routes keep their role-specific paths; roleMiddleware already checks the role.
exports.managerApproveRequest = decisionHandler('approve');
exports.managerRejectRequest = decisionHandler('reject');
exports.adminApproveRequest = decisionHandler('approve');
exports.adminRejectRequest = decisionHandler('reject');
exports.superAdminApproveRequest = decisionHandler('approve');
exports.superAdminRejectRequest = decisionHandler('reject');

// POST /:id/undo: the reviewer takes back their decision within the undo window.
exports.undoDecision = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ message: 'Leave request not found' });
    const request = await decisions.undo({ requestId: req.params.id, user: req.user });
    res.status(200).json({ message: 'Decision undone', request });
  } catch (error) {
    sendError(res, error, 'undoDecision');
  }
};

// POST /:id/counter-propose { startDate, endDate, note }
exports.counterPropose = async (req, res) => {
  try {
    const request = await findRequest(req, res);
    if (!request) return;
    const { startDate, endDate, note } = req.body || {};
    const updated = await decisions.counterPropose({ request, user: req.user, startDate, endDate, note });
    res.status(200).json({ message: 'New dates proposed to the employee', request: updated });
  } catch (error) {
    sendError(res, error, 'counterPropose');
  }
};

// POST /:id/counter-proposal/accept and /decline (the requester)
exports.respondToProposal = (accept) => async (req, res) => {
  try {
    const request = await findRequest(req, res);
    if (!request) return;
    const updated = await decisions.respondToProposal({ request, user: req.user, accept });
    res.status(200).json({ message: accept ? 'Proposed dates accepted' : 'Proposed dates declined', request: updated });
  } catch (error) {
    sendError(res, error, 'respondToProposal');
  }
};

// --- Decision support ----------------------------------------------------------------

const canSee = policies.canSeeLeave;

// GET /:id/context: approval track, team coverage, policy checks and suggested dates.
exports.getRequestContext = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ message: 'Leave request not found' });
    const request = await LeaveRequest.findById(req.params.id)
      .populate('employeeId', 'firstName lastName position role departmentId remainingLeaveDays leaveRequestAllowed profilePicture hireDate')
      .populate('managerId', 'firstName lastName role')
      .populate('history.by', 'firstName lastName')
      .populate('counterProposal.by', 'firstName lastName')
      .lean();
    if (!request) return res.status(404).json({ message: 'Leave request not found' });
    if (!canSee(req.user, request)) return res.status(403).json({ message: 'You are not allowed to view this request' });

    const employee = request.employeeId;
    const department = employee?.departmentId
      ? await Department.findById(employee.departmentId).select('name coverageLimit').lean()
      : null;
    const teamMembers = department
      ? await User.find({ ...User.ACTIVE, departmentId: department._id }).select('firstName lastName').lean()
      : [employee];
    const limit = rules.coverageLimitFor(department, teamMembers.length);

    // Leave around the request, wide enough to search for alternative dates.
    const teamLeave = await LeaveRequest.find({
      employeeId: { $in: teamMembers.map((m) => m._id) },
      startDate: { $lte: rules.addWorkdays(request.endDate, 60) },
      endDate: { $gte: rules.addWorkdays(request.startDate, -60) },
    }).select('employeeId startDate endDate status').lean();

    const subject = { ...request, employeeId: employee._id };
    const coverage = rules.buildCoverage({ request: subject, teamMembers, teamLeave, limit });
    // Balance of the year the request starts in (balances restart at 0 on 1 January).
    const yearly = await leaveHelper.balanceForDate(employee, request.startDate);
    const balance = { remaining: yearly.remainingDays, allowance: yearly.totalAccruedDays, year: yearly.year };
    const checks = rules.policyChecks({ request, balance, coverage });
    const suggestion = coverage.overLimit.length
      ? rules.suggestDates({ request: subject, teamLeave, limit, earliest: rules.addWorkdays(startOfDay(new Date()), 1) })
      : null;

    const me = String(req.user.id);
    const decision = request.decision;
    res.json({
      request: { ...request, workingDays: countWorkingDays(request.startDate, request.endDate) },
      department: department ? { id: department._id, name: department.name, limit, teamSize: teamMembers.length } : null,
      steps: rules.approvalSteps(request),
      coverage,
      checks,
      suggestion,
      canReview: policies.canReviewLeave(req.user, request),
      reviewPath: policies.LEAVE_REVIEW_PATH[req.user.role] || null,
      canUndo: Boolean(decision && policies.idOf(decision.by) === me && decision.notified === false && new Date(decision.undoUntil) > new Date()),
      canRespond: request.counterProposal?.status === 'open' && policies.idOf(employee._id) === me,
    });
  } catch (error) {
    console.error('Error building leave request context:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Requests created by admins, which the CEO reviews
exports.getAdminCreatedLeaveRequests = async (req, res) => {
  try {
    const adminLeaveRequests = await LeaveRequest.find({ createdBy: 'Admin' })
      .sort({ createdAt: -1 })
      .populate("employeeId", "firstName lastName email role")
      .populate("managerId", "firstName lastName email role")
      .lean();

    res.status(200).json(adminLeaveRequests);
  } catch (err) {
    console.error("Error fetching admin leave requests:", err);
    res.status(500).json({ message: "Internal Server Error" });
  }
};
