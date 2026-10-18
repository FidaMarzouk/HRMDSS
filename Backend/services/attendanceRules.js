// Pure attendance logic: recomputing a session after a correction, and the
// exceptions shown on day ribbons. Tested in tests/attendanceRules.test.js.
const { WORK_START, LATE_AFTER, WORK_END, startOfDay, isWeekend, minutesBetween } = require('../utils/time');
const { LONG_BREAK_MINUTES, REPEATED_LATENESS, MISSING_PUNCH_OUT_AFTER } = require('../constants/attendance');

const at = (day, { hour, minute }) => {
  const d = startOfDay(day);
  d.setHours(hour, minute, 0, 0);
  return d;
};

const breakMinutes = (b, until) => {
  if (!b.startTime) return 0;
  const end = b.endTime ? new Date(b.endTime) : until;
  return Math.max(0, Math.round((end - new Date(b.startTime)) / 60000));
};

/**
 * Derived fields of a session from its times, using the same rules as
 * punch-in/out: late after 08:30 (first session only), early before 08:00,
 * overtime before 08:00 and after 18:00, production hours minus breaks.
 * Returns { status, lateBy, earlyBy, overtime, productionHours, breaks }.
 */
const recomputeSession = ({ checkIn, checkOut, breaks = [], sessionNumber = 1, previousStatus }) => {
  const day = startOfDay(checkIn);
  const inAt = new Date(checkIn);
  const start = at(day, WORK_START);
  const lateLine = at(day, LATE_AFTER);
  const end = at(day, WORK_END);

  const earlyBy = inAt < start ? minutesBetween(inAt, start) : 0;
  const lateBy = sessionNumber === 1 && inAt > lateLine ? minutesBetween(lateLine, inAt) : 0;
  const status = sessionNumber === 1 ? (lateBy > 0 ? 'Late' : 'Present') : previousStatus || 'Present';

  // Breaks left open close at punch-out.
  const closedBreaks = breaks.map((b) => {
    if (!checkOut || b.endTime || !b.startTime) return b;
    const endTime = new Date(checkOut);
    return { ...b, endTime, duration: minutesBetween(new Date(b.startTime), endTime) };
  });

  let overtime = earlyBy;
  let productionHours = 0;
  if (checkOut) {
    const outAt = new Date(checkOut);
    if (outAt > end) overtime += minutesBetween(end, outAt);
    const paused = closedBreaks.reduce((n, b) => n + (b.startTime && b.endTime ? breakMinutes(b) : 0), 0);
    productionHours = Number((Math.max(0, (outAt - inAt) / 60000 - paused) / 60).toFixed(2));
  }
  return { status, lateBy, earlyBy, overtime, productionHours, breaks: closedBreaks };
};

/**
 * Exceptions for one person on one day.
 *  sessions: that day's attendance records
 *  isToday / now: open sessions only count as missing after 20:00 today
 * Returns [{ kind, label, tone }] with kind in
 *  late | absent | missing_punch_out | long_break
 */
const dayAnomalies = ({ sessions = [], day, now = new Date(), onLeave = false }) => {
  const out = [];
  const worked = sessions.filter((s) => s.checkIn).sort((a, b) => new Date(a.checkIn) - new Date(b.checkIn));
  const isToday = startOfDay(day).getTime() === startOfDay(now).getTime();

  if (!worked.length) {
    if (sessions.some((s) => s.status === 'Absent') && !onLeave) out.push({ kind: 'absent', label: 'Absent', tone: 'red' });
    return out;
  }
  const first = worked[0];
  if (first.status === 'Late' || first.lateBy > 0) out.push({ kind: 'late', label: `Late +${first.lateBy || 0}m`, tone: 'amber' });

  const open = worked.find((s) => !s.checkOut);
  if (open && (!isToday || now >= at(day, MISSING_PUNCH_OUT_AFTER))) {
    out.push({ kind: 'missing_punch_out', label: 'Missing punch-out', tone: 'red', sessionId: open._id ? String(open._id) : undefined });
  }

  const until = isToday ? now : at(day, WORK_END);
  const longest = Math.max(0, ...worked.flatMap((s) => (s.breaks || []).map((b) => breakMinutes(b, until))));
  if (longest > LONG_BREAK_MINUTES) out.push({ kind: 'long_break', label: `Break ${longest}m`, tone: 'amber' });
  return out;
};

/**
 * Repeated lateness: late on at least COUNT of the last WITHIN working days
 * up to `day`. lateDays: dates the person was late.
 */
const repeatedLateness = (lateDays, day = new Date()) => {
  const window = [];
  for (const d = startOfDay(day); window.length < REPEATED_LATENESS.withinWorkdays; d.setDate(d.getDate() - 1)) {
    if (!isWeekend(d)) window.push(d.getTime());
  }
  const inWindow = new Set(window);
  const count = new Set(lateDays.map((d) => startOfDay(d).getTime()).filter((t) => inWindow.has(t))).size;
  return count >= REPEATED_LATENESS.count ? { kind: 'repeated_lateness', label: `Late ${count}× in ${REPEATED_LATENESS.withinWorkdays} days`, tone: 'amber', count } : null;
};

// "mobile" when the browser says it is a phone or tablet, otherwise "web".
const detectSource = (userAgent = '') => (/Mobi|Android|iPhone|iPad|iPod/i.test(userAgent) ? 'mobile' : 'web');

module.exports = { recomputeSession, dayAnomalies, repeatedLateness, detectSource };
