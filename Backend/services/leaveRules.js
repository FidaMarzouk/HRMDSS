// Decision support for leave requests: team coverage, policy checks, the
// approval track and alternative dates. Pure functions, tested in
// tests/leaveRules.test.js; the controller loads the data.
const {
  FINAL_APPROVED, IN_PROGRESS, REJECTED, NOTICE_DAYS, NOTICE_EXEMPT_TYPES, DEFAULT_COVERAGE_RATIO,
} = require('../constants/leave');
const { startOfDay, isWeekend, countWorkingDays } = require('../utils/time');
const { idOf } = require('./policies');

const DAY = 24 * 60 * 60 * 1000;

// "YYYY-MM-DD" of a company day.
const dayKey = (date) => {
  const d = startOfDay(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

// Move by `n` working days (negative goes back); weekends are skipped.
const addWorkdays = (date, n) => {
  const d = startOfDay(date);
  const step = n < 0 ? -1 : 1;
  let left = Math.abs(n);
  while (left > 0) {
    d.setDate(d.getDate() + step);
    if (!isWeekend(d)) left--;
  }
  return d;
};

const workdaysBetween = (from, to) => {
  const out = [];
  for (const d = startOfDay(from); d <= startOfDay(to); d.setDate(d.getDate() + 1)) {
    if (!isWeekend(d)) out.push(new Date(d));
  }
  return out;
};

const covers = (r, day) => startOfDay(r.startDate) <= day && day <= startOfDay(r.endDate);
const fullName = (u) => (u ? `${u.firstName || ''} ${u.lastName || ''}`.trim() : '');
const shortName = (u) => (u ? `${u.firstName || ''} ${(u.lastName || '').charAt(0)}.`.trim() : '');

// Most people of one department who may be away on the same working day.
const coverageLimitFor = (department, teamSize) =>
  department?.coverageLimit || Math.max(1, Math.round(teamSize * DEFAULT_COVERAGE_RATIO));

// Requests that count as "away": final approvals and requests still in progress.
const countsAsAway = (r) => FINAL_APPROVED.includes(r.status) || IN_PROGRESS.includes(r.status);

/**
 * Team × working-days grid around a request.
 *  teamMembers: [{ _id, firstName, lastName }]  (the department, including the requester)
 *  teamLeave:   leave requests of those people overlapping the window (any status)
 * Cells: "request" (this one), "approved", "pending" or null.
 */
const buildCoverage = ({ request, teamMembers, teamLeave, limit, padding = 3, maxDays = 20 }) => {
  let days = workdaysBetween(addWorkdays(request.startDate, -padding), addWorkdays(request.endDate, padding));
  if (days.length > maxDays) {
    // Long requests: keep the request itself and trim the padding.
    days = workdaysBetween(request.startDate, request.endDate).slice(0, maxDays);
  }
  const others = teamLeave.filter((r) => idOf(r._id) !== idOf(request._id) && countsAsAway(r));
  const cellFor = (personId, day) => {
    if (idOf(request.employeeId) === personId && covers(request, day)) return 'request';
    const hit = others.filter((r) => idOf(r.employeeId) === personId && covers(r, day));
    if (hit.some((r) => FINAL_APPROVED.includes(r.status))) return 'approved';
    if (hit.length) return 'pending';
    return null;
  };

  const requesterId = idOf(request.employeeId);
  const allRows = teamMembers.map((m) => ({
    id: idOf(m._id),
    name: shortName(m),
    fullName: fullName(m),
    cells: days.map((day) => cellFor(idOf(m._id), day)),
  }));
  const rows = [
    ...allRows.filter((r) => r.id === requesterId),
    ...allRows.filter((r) => r.id !== requesterId && r.cells.some(Boolean)).sort((a, b) => a.name.localeCompare(b.name)),
  ];
  const away = days.map((_, i) => allRows.filter((r) => r.cells[i]).length);
  // Only days inside the request count against it: teammates' leave on the
  // padding days is context, not something this request causes.
  const inRequest = days.map((day) => covers(request, day));
  return {
    days: days.map(dayKey),
    inRequest,
    rows,
    othersAvailable: allRows.length - rows.length,
    away,
    limit,
    teamSize: teamMembers.length,
    overLimit: days.map(dayKey).filter((_, i) => inRequest[i] && away[i] > limit),
    maxAwayInRequest: Math.max(0, ...away.filter((_, i) => inRequest[i])),
  };
};

/**
 * Nearest dates of the same length (in working days) on which the team stays
 * within its limit, preferring later dates and never starting before `earliest`.
 */
const suggestDates = ({ request, teamLeave, limit, earliest, searchDays = 60 }) => {
  const length = countWorkingDays(request.startDate, request.endDate);
  if (length === 0) return null;
  const others = teamLeave.filter((r) => idOf(r._id) !== idOf(request._id) && countsAsAway(r));
  const fits = (start) => {
    const days = workdaysBetween(start, addWorkdays(start, length - 1));
    return days.every((day) => {
      const people = new Set(others.filter((r) => covers(r, day)).map((r) => idOf(r.employeeId)));
      if (people.has(idOf(request.employeeId))) return false; // the requester is already off
      return people.size + 1 <= limit;
    });
  };
  const floor = startOfDay(earliest);
  for (let k = 1; k <= searchDays; k++) {
    for (const offset of [k, -k]) {
      const start = addWorkdays(request.startDate, offset);
      if (start < floor) continue;
      if (fits(start)) return { startDate: start, endDate: addWorkdays(start, length - 1), workingDays: length };
    }
  }
  return null;
};

/**
 * Approval track for the stepped progress component.
 * [{ key, label, state: "done" | "current" | "todo" | "rejected", at? }]
 */
const approvalSteps = (request) => {
  const reviewers = {
    Employee: [['manager', 'Manager'], ['hr', 'HR']],
    Manager: [['hr', 'HR']],
    Admin: [['ceo', 'CEO']],
  }[request.createdBy || 'Employee'];
  const at = (action) => [...(request.history || [])].reverse().find((h) => h.action === action)?.at;
  const steps = [{ key: 'submitted', label: 'Submitted', state: 'done', at: request.createdAt }];

  const s = request.status;
  const doneUpTo = {
    'Pending': 0,
    'Manager Approved': 1,
    'Manager Rejected': 0,
    'Admin Approved': reviewers.length,
    'Admin Rejected': reviewers.length - 1,
    'CEO Approved': reviewers.length,
    'CEO Rejected': reviewers.length - 1,
  }[s] ?? 0;
  const rejected = REJECTED.includes(s);

  reviewers.forEach(([key, label], i) => {
    let state = 'todo';
    if (i < doneUpTo) state = 'done';
    else if (i === doneUpTo) state = rejected ? 'rejected' : 'current';
    steps.push({ key, label, state, at: state === 'done' || state === 'rejected' ? at(state === 'rejected' ? 'rejected' : 'approved') : undefined });
  });

  const final = FINAL_APPROVED.includes(s) || rejected;
  const notified = final && request.decision?.notified !== false;
  steps.push({ key: 'notified', label: 'Notified', state: notified ? 'done' : final ? 'current' : 'todo' });
  return steps;
};

const formatShort = (date) => new Date(date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

/**
 * Checks shown before a decision. tone: "ok" | "warn" | "fail" | "info".
 *  balance: { remaining, allowance } after the last recalculation
 */
const policyChecks = ({ request, balance, coverage, now = new Date() }) => {
  const checks = [];
  const days = countWorkingDays(request.startDate, request.endDate);

  // Notice
  if (NOTICE_EXEMPT_TYPES.includes(request.reason)) {
    checks.push({ id: 'notice', tone: 'info', text: `${request.reason}: no notice period applies` });
  } else {
    const submitted = request.createdAt || now;
    const given = Math.round((startOfDay(request.startDate) - startOfDay(submitted)) / DAY);
    checks.push(
      given >= NOTICE_DAYS
        ? { id: 'notice', tone: 'ok', text: `Submitted ${given} days ahead (policy: ${NOTICE_DAYS} days minimum)` }
        : { id: 'notice', tone: 'warn', text: `Submitted ${Math.max(0, given)} day${given === 1 ? '' : 's'} ahead; policy asks for ${NOTICE_DAYS}` }
    );
  }

  // Balance: approved requests are already counted in `remaining`.
  if (balance) {
    const after = FINAL_APPROVED.includes(request.status) ? balance.remaining : balance.remaining - days;
    checks.push(
      after >= 0
        ? { id: 'balance', tone: 'ok', text: `Balance after this request: ${after} of ${balance.allowance} days` }
        : { id: 'balance', tone: 'fail', text: `Exceeds the balance by ${-after} day${after === -1 ? '' : 's'} (${balance.remaining} left, ${days} requested)` }
    );
  }

  // Coverage
  if (coverage) {
    if (coverage.overLimit.length) {
      const worstIndex = coverage.days.indexOf(coverage.overLimit.reduce((a, b) => (coverage.away[coverage.days.indexOf(b)] > coverage.away[coverage.days.indexOf(a)] ? b : a)));
      const worstKey = coverage.days[worstIndex];
      const names = coverage.rows
        .filter((r) => r.cells[worstIndex] && r.cells[worstIndex] !== 'request')
        .map((r) => `${r.name} (${r.cells[worstIndex]})`);
      checks.push({
        id: 'coverage',
        tone: 'fail',
        text: `${formatShort(worstKey)}: ${coverage.away[worstIndex]} of ${coverage.teamSize} away, limit ${coverage.limit}${names.length ? `. Also off: ${names.join(', ')}` : ''}`,
      });
    } else {
      checks.push({ id: 'coverage', tone: 'ok', text: `Team stays within its limit (at most ${coverage.maxAwayInRequest} of ${coverage.teamSize} away, limit ${coverage.limit})` });
    }
  }
  return checks;
};

module.exports = {
  dayKey,
  addWorkdays,
  workdaysBetween,
  coverageLimitFor,
  buildCoverage,
  suggestDates,
  approvalSteps,
  policyChecks,
};
