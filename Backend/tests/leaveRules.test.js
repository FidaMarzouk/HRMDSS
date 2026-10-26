process.env.TZ = 'Africa/Tunis';
const test = require('node:test');
const assert = require('node:assert/strict');
const rules = require('../services/leaveRules');

const day = (s) => new Date(`${s}T00:00:00+01:00`);
const person = (id, first, last) => ({ _id: id, firstName: first, lastName: last });
const team = [
  person('u1', 'Rania', 'Trabelsi'), person('u2', 'Rim', 'Ferchichi'), person('u3', 'Haythem', 'Bouazizi'),
  person('u4', 'Emna', 'Gharbi'), person('u5', 'Ahmed', 'Zouari'), person('u6', 'Ons', 'Karray'),
  person('u7', 'Zied', 'Ayari'), person('u8', 'Nizar', 'Khelifi'), person('u9', 'Slim', 'Ben Ali'),
];
// Rania asks for Tue 24 – Fri 27 Nov 2026
const request = { _id: 'r1', employeeId: 'u1', startDate: day('2026-11-24'), endDate: day('2026-11-27'), reason: 'Vacation Leave', status: 'Pending', createdBy: 'Employee', createdAt: day('2026-10-02') };
const teamLeave = [
  request,
  { _id: 'r2', employeeId: 'u2', startDate: day('2026-11-25'), endDate: day('2026-11-26'), status: 'Admin Approved' },
  { _id: 'r3', employeeId: 'u3', startDate: day('2026-11-20'), endDate: day('2026-11-25'), status: 'Pending' },
  { _id: 'r4', employeeId: 'u4', startDate: day('2026-11-24'), endDate: day('2026-11-27'), status: 'Admin Rejected' },
];

test('working-day arithmetic skips weekends', () => {
  assert.equal(rules.dayKey(rules.addWorkdays(day('2026-11-27'), 1)), '2026-11-30'); // Fri + 1 = Mon
  assert.equal(rules.dayKey(rules.addWorkdays(day('2026-11-30'), -1)), '2026-11-27');
  assert.equal(rules.workdaysBetween(day('2026-11-27'), day('2026-11-30')).length, 2);
});

test('default coverage limit is 25% of the team rounded, at least 1; an explicit limit wins', () => {
  assert.equal(rules.coverageLimitFor(null, 9), 2);
  assert.equal(rules.coverageLimitFor(null, 7), 2);
  assert.equal(rules.coverageLimitFor(null, 5), 1);
  assert.equal(rules.coverageLimitFor(null, 2), 1);
  assert.equal(rules.coverageLimitFor({ coverageLimit: 4 }, 9), 4);
});

test('coverage grid marks this request, approved and pending leave, and the days over the limit', () => {
  const c = rules.buildCoverage({ request, teamMembers: team, teamLeave, limit: 2 });
  assert.equal(c.days[0], '2026-11-19'); // three working days before Tue 24
  assert.equal(c.days.at(-1), '2026-12-02');
  assert.deepEqual(c.rows.map((r) => r.id), ['u1', 'u3', 'u2']); // requester first, rejected Emna left out
  const i25 = c.days.indexOf('2026-11-25');
  assert.equal(c.rows[0].cells[i25], 'request');
  assert.equal(c.rows.find((r) => r.id === 'u2').cells[i25], 'approved');
  assert.equal(c.rows.find((r) => r.id === 'u3').cells[i25], 'pending');
  assert.equal(c.away[i25], 3);
  assert.deepEqual(c.overLimit, ['2026-11-25']);
  assert.equal(c.othersAvailable, 6);
  assert.equal(c.maxAwayInRequest, 3);
});

test('teammates over the limit outside the request do not count against it', () => {
  const short = { ...request, startDate: day('2026-11-23'), endDate: day('2026-11-23') }; // Monday only
  const c = rules.buildCoverage({ request: short, teamMembers: team, teamLeave, limit: 2 });
  assert.ok(c.away[c.days.indexOf('2026-11-25')] >= 2); // busy on the 25th, inside the grid's padding
  assert.deepEqual(c.overLimit, []);
  assert.equal(rules.policyChecks({ request: short, coverage: c }).find((x) => x.id === 'coverage').tone, 'ok');
});

test('suggested dates keep the same length and stay within the limit', () => {
  const s = rules.suggestDates({ request, teamLeave, limit: 2, earliest: day('2026-10-16') });
  // One working day later (Wed 25) still includes the over-limit 25th; the nearest
  // window that avoids it is Thu 26 – Tue 1 Dec.
  assert.equal(rules.dayKey(s.startDate), '2026-11-26');
  assert.equal(rules.dayKey(s.endDate), '2026-12-01');
  assert.equal(s.workingDays, 4);
});

test('no suggestion is made before the earliest allowed date', () => {
  const tight = rules.suggestDates({ request, teamLeave, limit: 2, earliest: day('2026-11-27'), searchDays: 1 });
  assert.equal(tight, null);
});

test('approval track follows the chain for each kind of requester', () => {
  const states = (r) => rules.approvalSteps(r).map((s) => `${s.label}:${s.state}`).join(' ');
  assert.equal(states(request), 'Submitted:done Manager:current HR:todo Notified:todo');
  assert.equal(states({ ...request, status: 'Manager Approved' }), 'Submitted:done Manager:done HR:current Notified:todo');
  assert.equal(states({ ...request, status: 'Admin Approved' }), 'Submitted:done Manager:done HR:done Notified:done');
  assert.equal(states({ ...request, status: 'Admin Approved', decision: { notified: false } }), 'Submitted:done Manager:done HR:done Notified:current');
  assert.equal(states({ ...request, status: 'Manager Rejected' }), 'Submitted:done Manager:rejected HR:todo Notified:done');
  assert.equal(states({ ...request, createdBy: 'Manager', status: 'Admin Rejected' }), 'Submitted:done HR:rejected Notified:done');
  assert.equal(states({ ...request, createdBy: 'Admin', status: 'Pending' }), 'Submitted:done CEO:current Notified:todo');
});

test('policy checks: notice, balance after the request, and coverage with names', () => {
  const coverage = rules.buildCoverage({ request, teamMembers: team, teamLeave, limit: 2 });
  const checks = rules.policyChecks({ request, balance: { remaining: 22, allowance: 26 }, coverage });
  assert.deepEqual(checks.map((c) => `${c.id}:${c.tone}`), ['notice:ok', 'balance:ok', 'coverage:fail']);
  assert.match(checks[0].text, /53 days ahead/);
  assert.match(checks[1].text, /18 of 26 days/);
  assert.match(checks[2].text, /25 Nov: 3 of 9 away, limit 2/);
  assert.match(checks[2].text, /Haythem B\. \(pending\)/);

  const late = rules.policyChecks({ request: { ...request, createdAt: day('2026-11-20') }, balance: { remaining: 2, allowance: 26 } });
  assert.deepEqual(late.map((c) => c.tone), ['warn', 'fail']);
  const sick = rules.policyChecks({ request: { ...request, reason: 'Sick Leave', createdAt: day('2026-11-24') } });
  assert.equal(sick[0].tone, 'info');
});
