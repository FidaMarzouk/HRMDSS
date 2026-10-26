// Pure helpers behind the Today view: the decision queue and presence.
// No database access, so they are unit-tested in tests/today.test.js.
const { FINAL_APPROVED, IN_PROGRESS } = require('../constants/leave');
const clash = require('./clash');
const { startOfDay, isWeekend } = require('../utils/time');
const { idOf } = require('./policies');

const DAY = 24 * 60 * 60 * 1000;
const SOON_DAYS = 7; // "starts in N days" warning below this

const fullName = (u) => (u ? `${u.firstName || ''} ${u.lastName || ''}`.trim() : '');

// Whole days from today to `date` (0 = today, negative = past).
const daysUntil = (date, now = new Date()) => Math.round((startOfDay(date) - startOfDay(now)) / DAY);

// First working day on which two date ranges overlap, or null.
const firstSharedWorkday = (a, b) => {
  const from = new Date(Math.max(startOfDay(a.startDate), startOfDay(b.startDate)));
  const to = new Date(Math.min(startOfDay(a.endDate), startOfDay(b.endDate)));
  for (const d = new Date(from); d <= to; d.setDate(d.getDate() + 1)) {
    if (!isWeekend(d)) return new Date(d);
  }
  return null;
};

/**
 * Teammates whose approved or in-progress leave overlaps `request`.
 * `teamLeave` is every relevant request for people in the same department.
 */
const leaveOverlaps = (request, teamLeave) =>
  teamLeave
    .filter((other) => idOf(other._id) !== idOf(request._id))
    .filter((other) => idOf(other.employeeId) !== idOf(request.employeeId))
    .filter((other) => FINAL_APPROVED.includes(other.status) || IN_PROGRESS.includes(other.status))
    .map((other) => ({ other, day: firstSharedWorkday(request, other) }))
    .filter((o) => o.day)
    .sort((a, b) => a.day - b.day);

const shortDate = (d) => new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

const leaveQueueItem = (request, overlapsFound, reviewPath, now) => {
  const startsIn = daysUntil(request.startDate, now);
  const flags = [];
  if (overlapsFound.length) {
    flags.push({ tone: 'red', label: `Overlap ${shortDate(overlapsFound[0].day)}`, detail: overlapsFound.map((o) => fullName(o.other.employeeId)).filter(Boolean).join(', ') });
  }
  if (startsIn < 0) flags.push({ tone: 'red', label: 'Already started' });
  else if (startsIn <= SOON_DAYS) flags.push({ tone: 'amber', label: startsIn === 0 ? 'Starts today' : `Starts in ${startsIn} day${startsIn === 1 ? '' : 's'}` });
  return {
    kind: 'leave',
    id: idOf(request._id),
    person: request.employeeId ? { id: idOf(request.employeeId), firstName: request.employeeId.firstName, lastName: request.employeeId.lastName, profilePicture: request.employeeId.profilePicture } : null,
    title: `${fullName(request.employeeId)} · ${request.reason}`,
    startDate: request.startDate,
    endDate: request.endDate,
    status: request.status,
    deadline: request.startDate,
    flags,
    approve: { method: 'put', url: `/api/leave-requests/${reviewPath}/${idOf(request._id)}/approve` },
  };
};

// Bookings of the same resource whose times overlap (pending or approved).
// Same rule as the calendar (services/clash.js): touching bookings do not clash.
const eventClashes = (event, others) => clash.clashesOf(event, others);

const EVENT_TYPE_LABEL = { meeting: 'Meeting', mission: 'Mission', resourceReservation: 'Booking' };

const eventQueueItem = (event, clashes, now) => {
  const startsIn = daysUntil(event.startDateTime, now);
  const flags = [];
  const confirmed = clash.blocking(clashes);
  if (confirmed.length) flags.push({ tone: 'red', label: 'Clash with a confirmed booking', detail: confirmed.map((c) => `${c.title} (${fullName(c.createdBy)})`).join(', ') });
  else if (clashes.length) flags.push({ tone: 'red', label: 'Clash', detail: clashes.map((c) => `${c.title} (${fullName(c.createdBy)}, pending)`).join(', ') });
  if (startsIn < 0) flags.push({ tone: 'red', label: 'Already started' });
  else if (startsIn <= 1) flags.push({ tone: 'amber', label: startsIn === 0 ? 'Today' : 'Tomorrow' });
  return {
    kind: 'event',
    id: idOf(event._id),
    person: event.createdBy ? { id: idOf(event.createdBy), firstName: event.createdBy.firstName, lastName: event.createdBy.lastName, profilePicture: event.createdBy.profilePicture } : null,
    title: `${fullName(event.createdBy)} · ${event.title}`,
    eventType: EVENT_TYPE_LABEL[event.eventType] || 'Event',
    startDate: event.startDateTime,
    endDate: event.endDateTime,
    deadline: event.startDateTime,
    flags,
    approve: { method: 'put', url: `/api/calendar/event/${idOf(event._id)}/review/approved` },
    // Approving is refused (409) while a confirmed booking overlaps.
    blocked: confirmed.length ? 'A confirmed booking overlaps this one: open the calendar to resolve it.' : null,
  };
};

const CORRECTION_LABEL = { missing_punch_out: 'Missing punch-out', missing_punch_in: 'Forgotten punch-in', wrong_times: 'Wrong times' };
const clock = (d) => (d ? new Date(d).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : '');

const correctionQueueItem = (c) => ({
  kind: 'correction',
  id: idOf(c._id),
  person: c.userId ? { id: idOf(c.userId), firstName: c.userId.firstName, lastName: c.userId.lastName, profilePicture: c.userId.profilePicture } : null,
  title: `${fullName(c.userId)} · ${CORRECTION_LABEL[c.kind]}`,
  correction: { kind: c.kind, checkIn: clock(c.checkIn), checkOut: clock(c.checkOut), reason: c.reason },
  startDate: c.date,
  endDate: c.date,
  // Corrections touch past days (and payroll): they sort by the day concerned.
  deadline: c.date,
  flags: [],
  approve: { method: 'put', url: `/api/attendance/corrections/${idOf(c._id)}/approve` },
});

// Soonest deadline first; items with a red flag first within the same day.
const sortQueue = (items) =>
  [...items].sort((a, b) => {
    const byDay = startOfDay(a.deadline) - startOfDay(b.deadline);
    if (byDay) return byDay;
    const red = (i) => (i.flags.some((f) => f.tone === 'red') ? 0 : 1);
    return red(a) - red(b);
  });

/**
 * Presence of one person today.
 *  in      punched in and not out (first session on time)
 *  late    punched in and not out, first session was late
 *  left    punched in today, all sessions closed
 *  leave   approved leave covering today
 *  mission approved mission covering now
 *  absent  marked absent
 *  out     none of the above (not in yet)
 */
const presenceStatus = ({ sessions = [], onLeave = false, onMission = false }) => {
  const worked = sessions.filter((s) => s.checkIn);
  if (worked.length) {
    const open = worked.some((s) => !s.checkOut);
    const first = [...worked].sort((a, b) => new Date(a.checkIn) - new Date(b.checkIn))[0];
    if (!open) return 'left';
    return first.status === 'Late' ? 'late' : 'in';
  }
  if (onLeave) return 'leave';
  if (onMission) return 'mission';
  if (sessions.some((s) => s.status === 'Absent')) return 'absent';
  return 'out';
};

const PRESENT = new Set(['in', 'late']);

// { total, in, late, away, left, out } for a list of people with a `status`.
const summarizePresence = (people) => {
  const count = (pred) => people.filter(pred).length;
  return {
    total: people.length,
    in: count((p) => PRESENT.has(p.status)),
    late: count((p) => p.status === 'late' || p.lateToday),
    away: count((p) => p.status === 'leave' || p.status === 'mission'),
    left: count((p) => p.status === 'left'),
    out: count((p) => p.status === 'out' || p.status === 'absent'),
  };
};

module.exports = {
  daysUntil,
  firstSharedWorkday,
  leaveOverlaps,
  leaveQueueItem,
  eventClashes,
  eventQueueItem,
  correctionQueueItem,
  sortQueue,
  presenceStatus,
  summarizePresence,
};
