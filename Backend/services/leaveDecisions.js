// Approve / reject with a server-side undo window, delayed notifications and
// counter-proposals. Controllers handle HTTP; this module owns the state changes.
//
// Undo safety: a decision's notifications go out only when an atomic update
// flips `decision.notified` from false to true after `undoUntil`. Undo only
// succeeds while that flag is still false, so a decision is either undone or
// notified, never both, even with several server processes.
const LeaveRequest = require('../Models/LeaveRequest');
const User = require('../Models/User');
const leaveHelper = require('../Middlewares/leaveCalculationHelper');
const { sendNotificationToUser, sendNotificationToRole, broadcast } = require('../Middlewares/notificationService');
const { FINAL_APPROVED, UNDO_WINDOW_MS } = require('../constants/leave');
const { countWorkingDays, toCompanyDate, startOfDay } = require('../utils/time');
const { idOf, canReviewLeave } = require('./policies');
const audit = require('./audit');

const auditLeave = (user, request, action, summary, note) =>
  audit.record({ actor: user, action, entity: 'LeaveRequest', entityId: request._id, subject: request.employeeId, summary, reason: note });

class DecisionError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

// New status for each reviewing role.
const TRANSITIONS = {
  manager: { approve: 'Manager Approved', reject: 'Manager Rejected' },
  admin: { approve: 'Admin Approved', reject: 'Admin Rejected' },
  superAdmin: { approve: 'CEO Approved', reject: 'CEO Rejected' },
};

const REVIEWER_LABEL = { manager: 'your manager', admin: 'HR', superAdmin: 'the CEO' };

const fullName = (u) => (u ? `${u.firstName} ${u.lastName}` : 'Unknown user');
const formatRange = (start, end) =>
  `${new Date(start).toLocaleDateString('en-GB')} to ${new Date(end).toLocaleDateString('en-GB')}`;
const withNote = (message, note) => (note ? `${message} Note: "${note}"` : message);

// --- Notifications ---------------------------------------------------------------

const timers = new Map();

// Notifications for a decision, matching the messages the app sent before Phase 3.
const sendDecisionNotifications = async (request) => {
  const { action, byRole, by, note } = request.decision;
  const [employee, reviewer] = await Promise.all([
    User.findById(request.employeeId).select('firstName lastName'),
    User.findById(by).select('firstName lastName'),
  ]);
  const range = formatRange(request.startDate, request.endDate);
  const verb = action === 'approved' ? 'approved' : 'rejected';
  const type = action === 'approved' ? 'leave_approved' : 'leave_rejected';
  const base = { type, relatedId: request._id };

  if (byRole === 'manager') {
    await sendNotificationToUser(request.employeeId, {
      ...base,
      title: `Leave Request ${action === 'approved' ? 'Approved' : 'Rejected'} by Manager`,
      message: withNote(
        action === 'approved'
          ? `Your leave request from ${range} has been approved by ${fullName(reviewer)} and is awaiting final HR approval.`
          : `Your leave request from ${range} has been rejected by ${fullName(reviewer)}.`,
        note
      ),
    });
    await sendNotificationToRole('admin', {
      ...base,
      title: `Leave Request ${action === 'approved' ? 'Approved' : 'Rejected'} by Manager`,
      message: `${fullName(reviewer)} has ${verb} a leave request for ${fullName(employee)} from ${range}.`,
    });
    return;
  }

  const by_ = byRole === 'superAdmin' ? 'the CEO' : 'HR';
  await sendNotificationToUser(request.employeeId, {
    ...base,
    title: `Leave Request ${action === 'approved' ? 'Approved' : 'Rejected'}${byRole === 'superAdmin' ? ' by CEO' : ''}`,
    message: withNote(`Your leave request from ${range} has been ${verb} by ${by_}.`, note),
  });
  if (byRole === 'admin' && idOf(request.managerId) !== idOf(by)) {
    await sendNotificationToUser(request.managerId, {
      ...base,
      title: `Leave Request ${action === 'approved' ? 'Approved' : 'Rejected'} by Admin`,
      message: `A leave request for ${fullName(employee)} from ${range} has been ${verb} by HR.`,
    });
  }
};

// Send a decision's notifications once its undo window has passed (exactly once).
const flush = async (requestId) => {
  timers.delete(String(requestId));
  const request = await LeaveRequest.findOneAndUpdate(
    { _id: requestId, 'decision.notified': false, 'decision.undoUntil': { $lte: new Date() } },
    { $set: { 'decision.notified': true } },
    { new: true }
  );
  if (!request) return;
  try {
    await sendDecisionNotifications(request);
  } catch (error) {
    console.error('Error sending leave decision notifications:', error);
  }
  broadcast('queue:changed');
};

const scheduleFlush = (requestId, at) => {
  const key = String(requestId);
  clearTimeout(timers.get(key));
  timers.set(key, setTimeout(() => flush(key), Math.max(0, new Date(at) - Date.now()) + 50));
};

// On startup: send anything whose window passed while the server was down.
const resumePendingNotifications = async () => {
  const pending = await LeaveRequest.find({ 'decision.notified': false }).select('_id decision.undoUntil').lean();
  pending.forEach((r) => scheduleFlush(r._id, r.decision.undoUntil));
  return pending.length;
};

// --- Decisions ----------------------------------------------------------------------

const refreshBalanceIfFinal = async (request, ...statuses) => {
  if (statuses.some((s) => FINAL_APPROVED.includes(s))) await leaveHelper.updateUserLeaveBalance(request.employeeId);
};

/**
 * Approve or reject. Applies immediately; notifications wait for the undo window.
 * An open counter-proposal is withdrawn (the reviewer decided on the original).
 */
const decide = async ({ request, user, action, note }) => {
  const transition = TRANSITIONS[user.role];
  if (!transition) throw new DecisionError(403, 'You are not allowed to review leave requests');
  if (idOf(request.employeeId) === String(user.id)) throw new DecisionError(403, 'You cannot review your own leave request');
  if (!canReviewLeave(user, request)) {
    throw new DecisionError(409, `This request can no longer be changed (current status: ${request.status}).`);
  }

  const now = new Date();
  const previous = { status: request.status, adminId: request.adminId || null, proposalStatus: request.counterProposal?.status || null };
  if (request.counterProposal?.status === 'open') {
    request.counterProposal.status = 'withdrawn';
    request.counterProposal.respondedAt = now;
    request.history.push({ action: 'proposal_withdrawn', status: request.status, by: user.id, byRole: user.role, at: now });
  }

  request.status = transition[action];
  if (user.role === 'admin') request.adminId = user.id;
  const cleanNote = note ? String(note).trim().slice(0, 500) : undefined;
  request.history.push({ action: action === 'approve' ? 'approved' : 'rejected', status: request.status, by: user.id, byRole: user.role, at: now, note: cleanNote });
  request.decision = {
    action: action === 'approve' ? 'approved' : 'rejected',
    by: user.id,
    byRole: user.role,
    at: now,
    undoUntil: new Date(now.getTime() + UNDO_WINDOW_MS),
    notified: false,
    note: cleanNote,
    previous,
  };
  await request.save();
  await refreshBalanceIfFinal(request, request.status);
  scheduleFlush(request._id, request.decision.undoUntil);
  await auditLeave(user, request, `leave.${action}`, `Leave ${formatRange(request.startDate, request.endDate)} ${action === 'approve' ? 'approved' : 'rejected'} (${request.status})`, cleanNote);
  return request;
};

/** Undo the caller's own decision while its window is open. */
const undo = async ({ requestId, user }) => {
  const request = await LeaveRequest.findById(requestId);
  if (!request?.decision?.by) throw new DecisionError(404, 'There is no decision to undo.');
  if (idOf(request.decision.by) !== String(user.id)) throw new DecisionError(403, 'Only the person who decided can undo it.');

  const now = new Date();
  const { previous } = request.decision;
  const decided = request.status;
  const update = {
    $set: { status: previous.status },
    $unset: { decision: '' },
    $push: { history: { action: 'undone', status: previous.status, by: user.id, byRole: user.role, at: now } },
  };
  if (previous.adminId) update.$set.adminId = previous.adminId;
  else update.$unset.adminId = '';
  if (previous.proposalStatus === 'open' && request.counterProposal?.status === 'withdrawn') {
    update.$set['counterProposal.status'] = 'open';
    update.$unset['counterProposal.respondedAt'] = '';
  }

  const undone = await LeaveRequest.findOneAndUpdate(
    { _id: requestId, 'decision.notified': false, 'decision.undoUntil': { $gte: now } },
    update,
    { new: true }
  );
  if (!undone) throw new DecisionError(409, 'Too late to undo: the decision has already been sent.');
  clearTimeout(timers.get(String(requestId)));
  timers.delete(String(requestId));
  await refreshBalanceIfFinal(undone, decided);
  await auditLeave(user, undone, 'leave.undo', `Decision on leave ${formatRange(undone.startDate, undone.endDate)} undone (back to ${undone.status})`);
  return undone;
};

// --- Counter-proposals ----------------------------------------------------------------

const parseRange = (startDate, endDate) => {
  const start = toCompanyDate(startDate);
  const end = toCompanyDate(endDate);
  if (!startDate || !endDate || Number.isNaN(start?.getTime?.()) || Number.isNaN(end?.getTime?.())) {
    throw new DecisionError(400, 'Valid start and end dates are required.');
  }
  if (start > end) throw new DecisionError(400, 'The start date must be on or before the end date.');
  if (countWorkingDays(start, end) === 0) throw new DecisionError(400, 'The proposed period has no working days.');
  return { start, end };
};

/** A reviewer suggests other dates instead of rejecting. */
const counterPropose = async ({ request, user, startDate, endDate, note }) => {
  if (!canReviewLeave(user, request)) throw new DecisionError(409, 'You can no longer change this request.');
  const { start, end } = parseRange(startDate, endDate);
  if (start <= startOfDay(new Date())) throw new DecisionError(400, 'Proposed dates must start after today.');
  if (+start === +startOfDay(request.startDate) && +end === +startOfDay(request.endDate)) {
    throw new DecisionError(400, 'The proposed dates are the same as the request.');
  }
  const now = new Date();
  const cleanNote = note ? String(note).trim().slice(0, 500) : undefined;
  request.counterProposal = { startDate: start, endDate: end, note: cleanNote, by: user.id, byRole: user.role, at: now, status: 'open' };
  request.history.push({ action: 'counter_proposed', status: request.status, by: user.id, byRole: user.role, at: now, note: cleanNote, startDate: start, endDate: end });
  await request.save();

  await auditLeave(user, request, 'leave.counter_propose', `Dates ${formatRange(start, end)} proposed instead of ${formatRange(request.startDate, request.endDate)}`, cleanNote);
  const reviewer = await User.findById(user.id).select('firstName lastName');
  await sendNotificationToUser(request.employeeId, {
    title: 'New dates proposed for your leave',
    message: withNote(
      `${fullName(reviewer)} suggests ${formatRange(start, end)} instead of ${formatRange(request.startDate, request.endDate)}. Accept or decline in Leave.`,
      cleanNote
    ),
    type: 'leave_counter_proposal',
    relatedId: request._id,
  });
  return request;
};

/** The employee accepts (dates change and the proposer's approval applies) or declines. */
const respondToProposal = async ({ request, user, accept }) => {
  if (idOf(request.employeeId) !== String(user.id)) throw new DecisionError(403, 'Only the requester can answer a proposal.');
  const proposal = request.counterProposal;
  if (proposal?.status !== 'open') throw new DecisionError(409, 'There is no open proposal for this request.');
  const now = new Date();
  const proposer = await User.findById(proposal.by).select('firstName lastName role');
  const employee = await User.findById(user.id).select('firstName lastName');

  if (!accept) {
    proposal.status = 'declined';
    proposal.respondedAt = now;
    request.history.push({ action: 'proposal_declined', status: request.status, by: user.id, byRole: user.role, at: now });
    await request.save();
    await sendNotificationToUser(proposal.by, {
      title: 'Proposed dates declined',
      message: `${fullName(employee)} declined ${formatRange(proposal.startDate, proposal.endDate)}. The original request (${formatRange(request.startDate, request.endDate)}) is back in your queue.`,
      type: 'leave_counter_proposal',
      relatedId: request._id,
    });
    return request;
  }

  // Accepting: the new dates must not clash with the requester's other leave or exceed the balance.
  const clash = await LeaveRequest.exists({
    _id: { $ne: request._id },
    employeeId: request.employeeId,
    startDate: { $lte: proposal.endDate },
    endDate: { $gte: proposal.startDate },
    status: { $nin: ['Manager Rejected', 'Admin Rejected', 'CEO Rejected'] },
  });
  if (clash) throw new DecisionError(400, 'You already have another leave request on some of the proposed days.');
  try {
    await leaveHelper.validateLeaveRequest(request.employeeId, proposal.startDate, proposal.endDate);
  } catch (error) {
    if (error instanceof leaveHelper.LeaveValidationError) throw new DecisionError(400, error.message);
    throw error;
  }

  const reviewer = { id: idOf(proposal.by), role: proposal.byRole };
  request.history.push({ action: 'proposal_accepted', status: request.status, by: user.id, byRole: user.role, at: now, startDate: proposal.startDate, endDate: proposal.endDate });
  request.startDate = proposal.startDate;
  request.endDate = proposal.endDate;
  proposal.status = 'accepted';
  proposal.respondedAt = now;

  // The proposer's approval applies to the accepted dates, if it is still theirs to give.
  const transition = TRANSITIONS[reviewer.role];
  if (transition && canReviewLeave(reviewer, { ...request.toObject(), counterProposal: null })) {
    request.status = transition.approve;
    if (reviewer.role === 'admin') request.adminId = reviewer.id;
    request.history.push({ action: 'approved', status: request.status, by: reviewer.id, byRole: reviewer.role, at: now, note: 'Approved with the proposed dates' });
  }
  await request.save();
  await refreshBalanceIfFinal(request, request.status);

  await sendNotificationToUser(proposal.by, {
    title: 'Proposed dates accepted',
    message: `${fullName(employee)} accepted ${formatRange(request.startDate, request.endDate)}. The request is now "${request.status}".`,
    type: 'leave_approved',
    relatedId: request._id,
  });
  if (reviewer.role === 'manager' && request.status === 'Manager Approved') {
    await sendNotificationToRole('admin', {
      title: 'Leave Request Approved by Manager',
      message: `${fullName(proposer)} has approved a leave request for ${fullName(employee)} from ${formatRange(request.startDate, request.endDate)} (dates agreed with the employee).`,
      type: 'leave_approved',
      relatedId: request._id,
    });
  }
  return request;
};

module.exports = {
  DecisionError,
  TRANSITIONS,
  REVIEWER_LABEL,
  decide,
  undo,
  counterPropose,
  respondToProposal,
  resumePendingNotifications,
};
