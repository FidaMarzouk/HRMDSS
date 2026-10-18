// Inbox: what a person can do about the item a notification (or a chat card)
// points to, worked out live from the item's current state and the viewer's
// role, with the same rules as Today and the review pages. A notification
// "needs action" while at least one action is available to its recipient.
const LeaveRequest = require('../Models/LeaveRequest');
const CalendarEvent = require('../Models/CalendarEvent');
const AttendanceCorrection = require('../Models/AttendanceCorrection');
require('../Models/Resource'); // registered for populate('resource')
const Notification = require('../Models/Notification');
const User = require('../Models/User');
const policies = require('./policies');
const { FINAL_APPROVED } = require('../constants/leave');
const { startOfDay, countWorkingDays } = require('../utils/time');

const { idOf } = policies;
const DAY = 24 * 60 * 60 * 1000;
const fullName = (u) => (u && typeof u === 'object' ? `${u.firstName || ''} ${u.lastName || ''}`.trim() : '');

// Which kind of item a notification type refers to.
const KIND_OF_TYPE = {
  leave_request: 'leave',
  leave_approved: 'leave',
  leave_rejected: 'leave',
  leave_counter_proposal: 'leave',
  event: 'event',
  event_invitation: 'event',
  event_response: 'event',
  attendance_correction: 'correction',
};
const kindOfType = (type) => KIND_OF_TYPE[type] || null;

// --- Loading ---------------------------------------------------------------------

const LOADERS = {
  leave: (ids) => LeaveRequest.find({ _id: { $in: ids } }).populate('employeeId', 'firstName lastName').lean(),
  event: (ids) => CalendarEvent.find({ _id: { $in: ids } }).populate('createdBy', 'firstName lastName').populate('resource', 'name').lean(),
  correction: (ids) => AttendanceCorrection.find({ _id: { $in: ids } }).populate('userId', 'firstName lastName').lean(),
};

// refs: [{ kind, id }] -> Map("kind:id" -> item)
const loadItems = async (refs) => {
  const byKind = new Map();
  refs.forEach(({ kind, id }) => {
    if (!LOADERS[kind] || !id) return;
    byKind.set(kind, [...(byKind.get(kind) || []), id]);
  });
  const out = new Map();
  await Promise.all(
    [...byKind.entries()].map(async ([kind, ids]) => {
      (await LOADERS[kind](ids)).forEach((item) => out.set(`${kind}:${idOf(item._id)}`, item));
    })
  );
  return out;
};

// --- Visibility ------------------------------------------------------------------

const canSeeEvent = (user, e, departmentId) =>
  user.role === 'admin' ||
  user.role === 'superAdmin' ||
  e.visibility === 'public' ||
  (e.visibility === 'department' && departmentId && idOf(e.departmentId) === String(departmentId)) ||
  idOf(e.createdBy) === String(user.id) ||
  (e.usersInvolved || []).some((u) => idOf(u.userId) === String(user.id));

const canSeeCorrection = (user, c) =>
  user.role === 'admin' || user.role === 'superAdmin' || idOf(c.userId) === String(user.id) || idOf(c.reviewerId) === String(user.id);

const canSee = (kind, item, user, departmentId) =>
  kind === 'leave' ? policies.canSeeLeave(user, item) : kind === 'event' ? canSeeEvent(user, item, departmentId) : kind === 'correction' ? canSeeCorrection(user, item) : false;

// --- Actions ---------------------------------------------------------------------

const PATHS = { leave: '/app/leave', event: '/app/calendar', correction: '/app/time' };

/**
 * Actions `user` can take on `item` right now: [{ id, label, tone, method, url, body? }].
 * Approvals are sent through the client's deferred "approve with undo".
 */
const actionsFor = (kind, item, user) => {
  if (!item) return [];
  const me = String(user.id);
  const id = idOf(item._id);
  const out = [];
  if (kind === 'leave') {
    if (item.counterProposal?.status === 'open' && idOf(item.employeeId) === me) {
      out.push({ id: 'accept_dates', label: 'Accept new dates', tone: 'primary', method: 'post', url: `/api/leave-requests/${id}/counter-proposal/accept` });
      out.push({ id: 'keep_dates', label: 'Keep my dates', tone: 'secondary', method: 'post', url: `/api/leave-requests/${id}/counter-proposal/decline` });
    } else if (policies.canReviewLeave(user, item) && item.counterProposal?.status !== 'open') {
      out.push({ id: 'approve', label: 'Approve', tone: 'primary', kind: 'approve', method: 'put', url: `/api/leave-requests/${policies.LEAVE_REVIEW_PATH[user.role]}/${id}/approve` });
    }
  }
  if (kind === 'event' && item.status !== 'declined') {
    const startsLater = new Date(item.endDateTime) >= startOfDay(new Date());
    if (startsLater && item.status === 'pending' && policies.canReviewEvents(user)) {
      out.push({ id: 'approve', label: 'Approve', tone: 'primary', kind: 'approve', method: 'put', url: `/api/calendar/event/${id}/review/approved` });
      out.push({ id: 'decline', label: 'Decline', tone: 'danger', method: 'put', url: `/api/calendar/event/${id}/review/declined` });
    }
    const invite = (item.usersInvolved || []).find((u) => idOf(u.userId) === me);
    if (startsLater && invite && invite.status === 'pending' && idOf(item.createdBy) !== me) {
      out.push({ id: 'accept', label: 'Accept', tone: out.length ? 'secondary' : 'primary', method: 'put', url: `/api/calendar/event/${id}/respond`, body: { status: 'accepted' } });
      out.push({ id: 'decline_invite', label: 'Decline', tone: 'secondary', method: 'put', url: `/api/calendar/event/${id}/respond`, body: { status: 'declined' } });
    }
  }
  if (kind === 'correction' && policies.canReviewCorrection(user, item)) {
    out.push({ id: 'approve', label: 'Approve', tone: 'primary', kind: 'approve', method: 'put', url: `/api/attendance/corrections/${id}/approve` });
  }
  return out;
};

// --- Priority -------------------------------------------------------------------

const daysUntil = (date, now) => Math.round((startOfDay(date) - startOfDay(now)) / DAY);

/**
 * Urgent items are pushed at once even with the digest on: something to act on
 * that starts today or tomorrow, sick and emergency leave, and decisions on
 * leave that starts within two days. Everything else is "normal".
 */
const priorityOf = (kind, item, { actionable, now = new Date() } = {}) => {
  if (!item) return 'normal';
  if (kind === 'leave') {
    const soon = daysUntil(item.startDate, now) <= 2;
    if (actionable && (soon || ['Sick Leave', 'Emergency Leave'].includes(item.reason))) return 'urgent';
    if (!actionable && soon && (FINAL_APPROVED.includes(item.status) || /Rejected/.test(item.status))) return 'urgent';
    return 'normal';
  }
  if (kind === 'event') return actionable && daysUntil(item.startDateTime, now) <= 1 ? 'urgent' : 'normal';
  if (kind === 'correction') return 'normal';
  return 'normal';
};

// --- Cards and summaries -------------------------------------------------------------

const range = (a, b) => {
  const f = (d) => new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  const y = (d) => new Date(d).getFullYear();
  return startOfDay(a).getTime() === startOfDay(b).getTime() ? `${f(a)} ${y(a)}` : `${f(a)} → ${f(b)} ${y(b)}`;
};
const clock = (d) => (d ? new Date(d).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : '');
const CORRECTION_LABEL = { missing_punch_out: 'Missing punch-out', missing_punch_in: 'Forgotten punch-in', wrong_times: 'Wrong times' };

// Status from the viewer's point of view ("Your decision", "Waiting on Zied"...).
const statusFor = (kind, item, user, actions) => {
  if (kind === 'leave') {
    if (item.counterProposal?.status === 'open') return idOf(item.employeeId) === String(user.id) ? 'New dates proposed' : 'Waiting on employee';
    if (actions.some((a) => a.id === 'approve')) return 'Your decision';
    return item.status;
  }
  if (kind === 'event') {
    if (actions.some((a) => a.id === 'approve')) return 'Your decision';
    if (actions.some((a) => a.id === 'accept')) return 'Invitation';
    return { pending: 'Pending approval', approved: 'Confirmed', declined: 'Declined' }[item.status] || item.status;
  }
  if (kind === 'correction') {
    if (actions.length) return 'Your decision';
    return { pending: 'Pending', approved: 'Approved', rejected: 'Rejected' }[item.status] || item.status;
  }
  return '';
};

/** Card for an item, as the viewer may see it, with live actions. */
const cardFor = (kind, item, user, departmentId) => {
  if (!item) return { kind, missing: true, title: 'This item no longer exists' };
  if (!canSee(kind, item, user, departmentId)) return { kind, id: idOf(item._id), hidden: true, title: 'You cannot view this item' };
  const actions = actionsFor(kind, item, user);
  const base = { kind, id: idOf(item._id), actions, status: statusFor(kind, item, user, actions), open: `${PATHS[kind]}` };
  if (kind === 'leave') {
    const p = item.counterProposal?.status === 'open' ? item.counterProposal : null;
    return {
      ...base,
      label: `Leave request · ${String(item.reason || '').replace(' Leave', '')}`,
      title: fullName(item.employeeId),
      detail: `${range(item.startDate, item.endDate)} · ${countWorkingDays(item.startDate, item.endDate)} working day${countWorkingDays(item.startDate, item.endDate) === 1 ? '' : 's'}${p ? ` · proposed ${range(p.startDate, p.endDate)}` : ''}`,
    };
  }
  if (kind === 'event') {
    return {
      ...base,
      label: { meeting: 'Meeting', mission: 'Mission', resourceReservation: 'Booking' }[item.eventType] || 'Event',
      title: item.title,
      detail: `${range(item.startDateTime, item.endDateTime)} · ${clock(item.startDateTime)}–${clock(item.endDateTime)}${item.resource?.name ? ` · ${item.resource.name}` : item.location ? ` · ${item.location}` : ''}`,
      open: `/app/calendar?date=${new Date(item.startDateTime).toISOString().slice(0, 10)}`,
    };
  }
  return {
    ...base,
    label: `Time correction · ${CORRECTION_LABEL[item.kind] || item.kind}`,
    title: fullName(item.userId),
    detail: `${range(item.date, item.date)}${item.checkIn ? ` · in ${clock(item.checkIn)}` : ''}${item.checkOut ? ` · out ${clock(item.checkOut)}` : ''}`,
  };
};

// --- Keeping "needs action" current ------------------------------------------------------

/**
 * Re-check every actionable notification about `relatedId`: mark it done when
 * its recipient has nothing left to do, or open it again when they do (e.g. a
 * leave request HR can now decide after the manager approved). Safe to call
 * after any change to the item; never throws.
 */
const refresh = async (relatedId) => {
  try {
    if (!relatedId) return;
    const notes = await Notification.find({ relatedId, actionable: true }).select('recipient type doneAt').lean();
    if (!notes.length) return;
    const kind = kindOfType(notes[0].type);
    if (!kind) return;
    const item = (await loadItems([{ kind, id: relatedId }])).get(`${kind}:${idOf(relatedId)}`);
    const users = await User.find({ _id: { $in: notes.map((n) => n.recipient) } }).select('role').lean();
    const roleOf = new Map(users.map((u) => [idOf(u._id), u.role]));
    const now = new Date();
    const ops = notes
      .map((n) => {
        const has = item ? actionsFor(kind, item, { id: idOf(n.recipient), role: roleOf.get(idOf(n.recipient)) }).length > 0 : false;
        if (has && n.doneAt) return { updateOne: { filter: { _id: n._id }, update: { $set: { doneAt: null } } } };
        if (!has && !n.doneAt) return { updateOne: { filter: { _id: n._id }, update: { $set: { doneAt: now } } } };
        return null;
      })
      .filter(Boolean);
    if (ops.length) await Notification.bulkWrite(ops, { ordered: false });
  } catch (error) {
    console.error('Inbox refresh failed:', error);
  }
};

// --- Digest ---------------------------------------------------------------------------

const DIGEST_GROUPS = [
  { kind: 'leave', one: 'leave update', many: 'leave updates' },
  { kind: 'event', one: 'calendar update', many: 'calendar updates' },
  { kind: 'correction', one: 'time correction update', many: 'time correction updates' },
  { kind: null, one: 'other update', many: 'other updates' },
];

/** "5 updates: 2 leave updates, 2 calendar updates, 1 time correction update." */
const digestMessage = (notes) => {
  const parts = DIGEST_GROUPS.map((g) => {
    const n = notes.filter((x) => kindOfType(x.type) === g.kind).length;
    return n ? `${n} ${n === 1 ? g.one : g.many}` : null;
  }).filter(Boolean);
  const waiting = notes.filter((x) => x.actionable && !x.doneAt).length;
  return `${notes.length} update${notes.length === 1 ? '' : 's'} since your last digest: ${parts.join(', ')}.${waiting ? ` ${waiting} still need${waiting === 1 ? 's' : ''} your action.` : ''}`;
};

module.exports = { kindOfType, loadItems, canSee, actionsFor, priorityOf, cardFor, refresh, digestMessage };
