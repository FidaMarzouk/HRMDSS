const mongoose = require("mongoose");
const LeaveRequest = require("../Models/LeaveRequest");
const User = require("../Models/User");
const leaveHelper = require('../Middlewares/leaveCalculationHelper');
const { sendNotificationToUser, sendNotificationToRole } = require('../Middlewares/notificationService');
const { LEAVE_TYPES, REJECTED } = require('../constants/leave');

const formatRange = (request) =>
  `${new Date(request.startDate).toLocaleDateString()} to ${new Date(request.endDate).toLocaleDateString()}`;

const fullName = (user) => (user ? `${user.firstName} ${user.lastName}` : 'Unknown user');

/**
 * Who must act on a leave request created by this user. Derived server-side so
 * requesters cannot route their request to an approver of their choice.
 *   employee -> their manager, manager -> an admin, admin -> the CEO (superAdmin)
 */
const resolveApprover = async (user) => {
  switch (user.role) {
    case 'employee':
      return user.managerId
        ? User.findById(user.managerId).select('firstName lastName role')
        : null;
    case 'manager':
      return User.findOne({ role: 'admin' }).select('firstName lastName role');
    case 'admin':
      return User.findOne({ role: 'superAdmin' }).select('firstName lastName role');
    default:
      return null;
  }
};

const CREATED_BY = { employee: 'Employee', manager: 'Manager', admin: 'Admin' };

const hasOverlappingRequest = async (userId, startDate, endDate) => {
  const start = new Date(startDate);
  start.setHours(0, 0, 0, 0);
  const end = new Date(endDate);
  end.setHours(0, 0, 0, 0);

  const overlapping = await LeaveRequest.exists({
    employeeId: userId,
    startDate: { $lte: end },
    endDate: { $gte: start },
    status: { $nin: REJECTED }
  });
  return Boolean(overlapping);
};

// Load the request for an approval action, enforcing existence and scope.
const loadRequestForAction = async (req, res, scopeCheck) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    res.status(404).json({ message: 'Leave request not found' });
    return null;
  }
  const request = await LeaveRequest.findById(req.params.id);
  if (!request) {
    res.status(404).json({ message: 'Leave request not found' });
    return null;
  }
  if (request.employeeId.toString() === req.user.id) {
    res.status(403).json({ message: 'You cannot review your own leave request' });
    return null;
  }
  if (scopeCheck && !scopeCheck(request)) {
    res.status(403).json({ message: 'You are not allowed to review this leave request' });
    return null;
  }
  return request;
};

const invalidTransition = (res, request) =>
  res.status(409).json({ message: `This request can no longer be changed (current status: ${request.status}).` });

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
    const start = new Date(startDate);
    const end = new Date(endDate);
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
      createdBy: CREATED_BY[user.role]
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

// Manager approves a request assigned to them
exports.managerApproveRequest = async (req, res) => {
  try {
    const request = await loadRequestForAction(req, res, (r) => r.managerId.toString() === req.user.id);
    if (!request) return;
    if (request.status !== 'Pending') return invalidTransition(res, request);

    request.status = 'Manager Approved';
    await request.save();

    const [employee, manager] = await Promise.all([
      User.findById(request.employeeId).select('firstName lastName'),
      User.findById(req.user.id).select('firstName lastName')
    ]);

    await sendNotificationToUser(request.employeeId, {
      title: 'Leave Request Approved by Manager',
      message: `Your leave request from ${formatRange(request)} has been approved by ${fullName(manager)} and is awaiting final HR approval.`,
      type: 'leave_approved',
      relatedId: request._id
    });
    await sendNotificationToRole('admin', {
      title: 'Leave Request Approved by Manager',
      message: `${fullName(manager)} has approved a leave request for ${fullName(employee)} from ${formatRange(request)}.`,
      type: 'leave_approved',
      relatedId: request._id
    });

    res.status(200).json({ message: 'Request approved by manager', request });
  } catch (error) {
    console.error('Error in managerApproveRequest:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Manager rejects a request assigned to them
exports.managerRejectRequest = async (req, res) => {
  try {
    const request = await loadRequestForAction(req, res, (r) => r.managerId.toString() === req.user.id);
    if (!request) return;
    if (request.status !== 'Pending') return invalidTransition(res, request);

    request.status = 'Manager Rejected';
    await request.save();

    const [employee, manager] = await Promise.all([
      User.findById(request.employeeId).select('firstName lastName'),
      User.findById(req.user.id).select('firstName lastName')
    ]);

    await sendNotificationToUser(request.employeeId, {
      title: 'Leave Request Rejected by Manager',
      message: `Your leave request from ${formatRange(request)} has been rejected by ${fullName(manager)}.`,
      type: 'leave_rejected',
      relatedId: request._id
    });
    await sendNotificationToRole('admin', {
      title: 'Leave Request Rejected by Manager',
      message: `${fullName(manager)} has rejected a leave request for ${fullName(employee)} from ${formatRange(request)}.`,
      type: 'leave_rejected',
      relatedId: request._id
    });

    res.status(200).json({ message: 'Request rejected by manager', request });
  } catch (error) {
    console.error('Error in managerRejectRequest:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Admin gives final approval to employee and manager requests (admin requests go to the CEO)
exports.adminApproveRequest = async (req, res) => {
  try {
    const request = await loadRequestForAction(req, res, (r) => r.createdBy !== 'Admin');
    if (!request) return;
    if (!['Pending', 'Manager Approved'].includes(request.status)) return invalidTransition(res, request);

    request.status = 'Admin Approved';
    request.adminId = req.user.id;
    await request.save();
    await leaveHelper.updateUserLeaveBalance(request.employeeId);

    const employee = await User.findById(request.employeeId).select('firstName lastName');

    await sendNotificationToUser(request.employeeId, {
      title: 'Leave Request Approved',
      message: `Your leave request from ${formatRange(request)} has been approved by HR.`,
      type: 'leave_approved',
      relatedId: request._id
    });
    if (request.managerId.toString() !== req.user.id) {
      await sendNotificationToUser(request.managerId, {
        title: 'Leave Request Approved by Admin',
        message: `A leave request for ${fullName(employee)} from ${formatRange(request)} has been approved by HR.`,
        type: 'leave_approved',
        relatedId: request._id
      });
    }

    res.status(200).json({ message: 'Request approved by admin', request });
  } catch (error) {
    console.error('Error in adminApproveRequest:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Admin rejects a request
exports.adminRejectRequest = async (req, res) => {
  try {
    const request = await loadRequestForAction(req, res, (r) => r.createdBy !== 'Admin');
    if (!request) return;
    if (!['Pending', 'Manager Approved'].includes(request.status)) return invalidTransition(res, request);

    request.status = 'Admin Rejected';
    request.adminId = req.user.id;
    await request.save();

    const employee = await User.findById(request.employeeId).select('firstName lastName');

    await sendNotificationToUser(request.employeeId, {
      title: 'Leave Request Rejected',
      message: `Your leave request from ${formatRange(request)} has been rejected by HR.`,
      type: 'leave_rejected',
      relatedId: request._id
    });
    if (request.managerId.toString() !== req.user.id) {
      await sendNotificationToUser(request.managerId, {
        title: 'Leave Request Rejected by Admin',
        message: `A leave request for ${fullName(employee)} from ${formatRange(request)} has been rejected by HR.`,
        type: 'leave_rejected',
        relatedId: request._id
      });
    }

    res.status(200).json({ message: 'Request rejected by admin', request });
  } catch (error) {
    console.error('Error in adminRejectRequest:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// CEO approves a request created by an admin
exports.superAdminApproveRequest = async (req, res) => {
  try {
    const request = await loadRequestForAction(req, res, (r) => r.createdBy === 'Admin');
    if (!request) return;
    if (request.status !== 'Pending') return invalidTransition(res, request);

    request.status = 'CEO Approved';
    await request.save();
    await leaveHelper.updateUserLeaveBalance(request.employeeId);

    await sendNotificationToUser(request.employeeId, {
      title: 'Leave Request Approved by CEO',
      message: `Your leave request from ${formatRange(request)} has been approved by the CEO.`,
      type: 'leave_approved',
      relatedId: request._id
    });

    res.status(200).json({ message: 'Request approved by CEO', request });
  } catch (error) {
    console.error('Error in superAdminApproveRequest:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// CEO rejects a request created by an admin
exports.superAdminRejectRequest = async (req, res) => {
  try {
    const request = await loadRequestForAction(req, res, (r) => r.createdBy === 'Admin');
    if (!request) return;
    if (request.status !== 'Pending') return invalidTransition(res, request);

    request.status = 'CEO Rejected';
    await request.save();

    await sendNotificationToUser(request.employeeId, {
      title: 'Leave Request Rejected by CEO',
      message: `Your leave request from ${formatRange(request)} has been rejected by the CEO.`,
      type: 'leave_rejected',
      relatedId: request._id
    });

    res.status(200).json({ message: 'Request rejected by CEO', request });
  } catch (error) {
    console.error('Error in superAdminRejectRequest:', error);
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
