// Draft lifecycle: the agent prepares, the person confirms or cancels.
// Confirming runs the same route handler the screens use, as the confirming
// person (services/assistant/invoke.js), so every rule, notification and audit
// entry applies; the assistant itself never writes HR data.
const mongoose = require('mongoose');
const AssistantDraft = require('../../Models/AssistantDraft');
const audit = require('../audit');
const { callController } = require('./invoke');
const leave = require('../../Controllers/leaveRequestController');
const calendar = require('../../Controllers/calendarController');
const attendance = require('../../Controllers/attendanceController');
const time = require('../../Controllers/timeController');
const chat = require('../../Controllers/ChatController');

const DRAFT_TTL_MS = 30 * 60 * 1000;

const LEAVE_DECISION = {
  manager: { approve: leave.managerApproveRequest, reject: leave.managerRejectRequest },
  admin: { approve: leave.adminApproveRequest, reject: leave.adminRejectRequest },
  superAdmin: { approve: leave.superAdminApproveRequest, reject: leave.superAdminRejectRequest },
};
const PUNCH = { in: attendance.punchIn, out: attendance.punchOut, break_start: attendance.startBreak, break_end: attendance.endBreak };

// How each kind of draft is carried out, with the socket events its route broadcasts.
const COMMIT = {
  leave_request: (p, user) => callController(leave.createLeaveRequest, { user, body: p }, { broadcastOn: 'queue:changed' }),
  proposal_response: (p, user) => callController(leave.respondToProposal(p.accept), { user, params: { id: p.requestId } }, { broadcastOn: 'queue:changed' }),
  leave_decision: (p, user) => {
    const handler = LEAVE_DECISION[user.role]?.[p.decision];
    if (!handler) return { status: 403, body: { message: 'Only the designated reviewer can decide this request.' } };
    return callController(handler, { user, params: { id: p.requestId }, body: { note: p.note } }, { broadcastOn: 'queue:changed' });
  },
  booking: (p, user) => callController(calendar.createEvent, { user, body: p }, { broadcastOn: 'queue:changed' }),
  meeting: (p, user) => callController(calendar.createEvent, { user, body: p }, { broadcastOn: 'queue:changed' }),
  mission: (p, user) => callController(calendar.createEvent, { user, body: p }, { broadcastOn: 'queue:changed' }),
  invitation_response: (p, user) => callController(calendar.updateAttendeeStatus, { user, params: { eventId: p.eventId }, body: { status: p.status } }, { broadcastOn: 'queue:changed' }),
  event_decision: (p, user) => callController(calendar.adminReviewEvent, { user, params: { eventId: p.eventId, status: p.status } }, { broadcastOn: 'queue:changed' }),
  punch: (p, user) => callController(PUNCH[p.action], { user }, { broadcastOn: 'presence:changed' }),
  correction: (p, user) => callController(time.createCorrection, { user, body: p }, { broadcastOn: 'queue:changed' }),
  correction_decision: (p, user) =>
    callController(p.approve ? time.approveCorrection : time.rejectCorrection, { user, params: { id: p.correctionId }, body: { note: p.note } }, { broadcastOn: ['queue:changed', 'presence:changed'] }),
  message: (p, user) => callController(chat.sendMessage, { user, body: p }),
};

const view = (d) => ({
  id: String(d._id),
  kind: d.kind,
  title: d.title,
  details: d.details,
  checks: d.checks,
  status: d.status,
  expiresAt: d.expiresAt,
  result: d.result || null,
  error: d.error || null,
});

/** Called by "prepare" tools. */
const create = async (ctx, { kind, title, details = [], checks = [], payload }) => {
  const draft = await AssistantDraft.create({
    userId: ctx.user.id,
    threadId: ctx.threadId,
    kind,
    title,
    details,
    checks,
    payload,
    expiresAt: new Date(Date.now() + DRAFT_TTL_MS),
  });
  return {
    draft: view(draft),
    note: 'Prepared, not saved. The person sees it as a card and must confirm it in the app; tell them what you prepared and anything the checks flagged.',
  };
};

const load = async (userId, id) => {
  if (!mongoose.isValidObjectId(id)) return null;
  return AssistantDraft.findOne({ _id: id, userId });
};

// A short, model-friendly summary of what the confirmation produced.
const summarize = (kind, body) => {
  if (!body) return null;
  if (kind === 'leave_request') return { requestId: body.leaveRequest?._id, status: body.leaveRequest?.status, reviewer: body.approver ? `${body.approver.firstName} ${body.approver.lastName}` : null };
  if (['booking', 'meeting', 'mission'].includes(kind)) return { eventId: body._id, status: body.status, pendingClashes: (body.clashes || []).length };
  if (kind === 'correction') return { correctionId: body.correction?._id, reviewer: body.reviewer ? `${body.reviewer.firstName} ${body.reviewer.lastName}` : null };
  if (kind === 'message') return { messageId: body._id };
  return { message: body.message || 'Done' };
};

/**
 * Confirm a draft as the signed-in person (never as the agent).
 * Returns the updated draft view; a refused action marks the draft "failed".
 */
const confirm = async (user, id) => {
  const draft = await load(user.id, id);
  if (!draft) return { error: 'Draft not found', status: 404 };
  if (draft.status !== 'pending') return { error: `This draft is already ${draft.status}`, status: 409 };
  if (draft.expiresAt < new Date()) {
    draft.status = 'expired';
    await draft.save();
    return { error: 'This draft expired: ask the assistant to prepare it again.', status: 410 };
  }
  const commit = COMMIT[draft.kind];
  let outcome;
  try {
    outcome = await commit(draft.payload, user);
  } catch (error) {
    console.error('Assistant draft commit failed:', error);
    outcome = { status: 500, body: { message: 'Server error' } };
  }
  const ok = outcome.status < 400;
  draft.status = ok ? 'confirmed' : 'failed';
  draft.decidedAt = new Date();
  draft.result = ok ? summarize(draft.kind, outcome.body) : null;
  draft.error = ok ? undefined : outcome.body?.message || 'The action was refused';
  await draft.save();
  if (ok) {
    await audit.record({
      actor: user,
      action: 'assistant.confirm',
      entity: 'AssistantDraft',
      entityId: draft._id,
      subject: user.id,
      summary: `${draft.title} (prepared by the ENOVA Assistant, confirmed by the person)`,
    }).catch(() => {});
  }
  return { draft: view(draft), status: ok ? 200 : outcome.status };
};

const cancel = async (user, id) => {
  const draft = await load(user.id, id);
  if (!draft) return { error: 'Draft not found', status: 404 };
  if (draft.status !== 'pending') return { error: `This draft is already ${draft.status}`, status: 409 };
  draft.status = 'cancelled';
  draft.decidedAt = new Date();
  await draft.save();
  return { draft: view(draft), status: 200 };
};

module.exports = { DRAFT_TTL_MS, create, confirm, cancel, view, COMMIT };
