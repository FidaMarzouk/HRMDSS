process.env.TZ = 'Africa/Tunis';
const test = require('node:test');
const assert = require('node:assert/strict');
const a = require('../services/analytics');

const d = (s) => new Date(`${s}T00:00:00`);
const at = (day, hm) => new Date(`${day}T${hm}:00+01:00`);

test('periods: previous period has the same length and ends the day before', () => {
  const p = a.periods(d('2026-10-01'), d('2026-10-31'));
  assert.equal(p.days, 31);
  assert.equal(a.dayKey(p.previous.to), '2026-09-30');
  assert.equal(a.dayKey(p.previous.from), '2026-08-31');
});

test('workdays skip weekends; nextWorkdays counts working days only', () => {
  assert.deepEqual(a.workdays(d('2026-10-16'), d('2026-10-20')).map(a.dayKey), ['2026-10-16', '2026-10-19', '2026-10-20']);
  const next = a.nextWorkdays(d('2026-10-17'), 3); // Saturday
  assert.deepEqual(next.map(a.dayKey), ['2026-10-19', '2026-10-20', '2026-10-21']);
});

test('arrivals keep only first sessions with a punch-in, in company minutes', () => {
  const list = a.arrivals([
    { userId: 'u1', date: d('2026-10-14'), sessionNumber: 1, checkIn: at('2026-10-14', '08:42'), status: 'Late' },
    { userId: 'u1', date: d('2026-10-14'), sessionNumber: 2, checkIn: at('2026-10-14', '14:00'), status: 'Late' },
    { userId: 'u2', date: d('2026-10-14'), status: 'Absent' },
  ]);
  assert.equal(list.length, 1);
  assert.equal(list[0].minutes, 8 * 60 + 42);
  assert.equal(list[0].late, true);
});

test('barcode: leave wins over absence, no record and pre-hire days stay empty, rate excludes leave', () => {
  const days = a.workdays(d('2026-10-12'), d('2026-10-16'));
  const people = [{ id: 'u1', name: 'Amal B', department: 'R&D', hireDate: d('2026-10-13') }];
  const sessions = [
    { userId: 'u1', date: d('2026-10-13'), checkIn: at('2026-10-13', '08:10'), status: 'Present' },
    { userId: 'u1', date: d('2026-10-14'), checkIn: at('2026-10-14', '08:50'), status: 'Late' },
    { userId: 'u1', date: d('2026-10-15'), status: 'Absent' },
    { userId: 'u1', date: d('2026-10-16'), status: 'Absent' },
  ];
  const leaves = [{ employeeId: 'u1', startDate: d('2026-10-16'), endDate: d('2026-10-16'), status: 'Admin Approved' }];
  const [row] = a.barcode({ people, days, sessions, leaves });
  assert.deepEqual(row.cells, [null, 'present', 'late', 'absent', 'leave']);
  assert.equal(row.rate, 66.7); // 2 attended of 3 expected
  const t = a.tickerFromBarcode([row], days);
  assert.equal(t.attendanceRate, 66.7);
  assert.equal(t.punctuality, 50);
  assert.equal(t.absences, 1);
});

test('attendance rate can never exceed 100% (one cell per person-day)', () => {
  const days = a.workdays(d('2026-10-14'), d('2026-10-14'));
  const sessions = [1, 2, 3].map((n) => ({ userId: 'u1', date: d('2026-10-14'), sessionNumber: n, checkIn: at('2026-10-14', `0${7 + n}:00`), status: 'Present' }));
  const rows = a.barcode({ people: [{ id: 'u1' }], days, sessions, leaves: [] });
  assert.equal(a.tickerFromBarcode(rows, days).attendanceRate, 100);
});

test('tide counts a person once per day, approved over pending, and finds days over the limit', () => {
  const days = a.workdays(d('2026-10-19'), d('2026-10-21'));
  const leaves = [
    { employeeId: 'u1', startDate: d('2026-10-19'), endDate: d('2026-10-20'), status: 'Admin Approved' },
    { employeeId: 'u1', startDate: d('2026-10-20'), endDate: d('2026-10-20'), status: 'Pending' },
    { employeeId: 'u2', startDate: d('2026-10-20'), endDate: d('2026-10-21'), status: 'Manager Approved' },
    { employeeId: 'u3', startDate: d('2026-10-20'), endDate: d('2026-10-20'), status: 'Rejected' },
  ];
  const t = a.tide({ days, leaves, limit: 1 });
  assert.deepEqual(t.columns.map((c) => [c.approved, c.pending]), [[1, 0], [1, 1], [0, 1]]);
  assert.deepEqual(t.overLimit, ['2026-10-20']);
  assert.equal(t.peak.date, '2026-10-20');
});

test('hours budget: contracted is 8 h 30 per expected day, overtime in hours', () => {
  const people = [{ id: 'u1', departmentId: 'd1', department: 'R&D' }, { id: 'u2', departmentId: 'd1', department: 'R&D' }];
  const sessions = [{ userId: 'u1', productionHours: 9, overtime: 30 }, { userId: 'u2', productionHours: 8, overtime: 0 }];
  const [row] = a.hoursBudget({ people, sessions, expectedDays: new Map([['u1', 1], ['u2', 1]]) });
  assert.equal(row.contracted, 17);
  assert.equal(row.worked, 17);
  assert.equal(row.overtime, 0.5);
  assert.equal(row.delta, 0);
});

test('swarm groups arrivals by department with medians and late counts', () => {
  const people = [{ id: 'u1', departmentId: 'd1', department: 'R&D' }, { id: 'u2', departmentId: 'd2', department: 'Sales' }];
  const cur = [{ userId: 'u1', minutes: 480, late: false }, { userId: 'u1', minutes: 540, late: true }, { userId: 'u1', minutes: 500, late: false }];
  const [rd] = a.swarm(people, cur, []);
  assert.equal(rd.name, 'R&D');
  assert.equal(rd.medianCurrent, 500);
  assert.equal(rd.lateCurrent, 1);
  assert.equal(a.swarm(people, cur, []).length, 1); // Sales has no arrivals
});

test('signals: coverage first, then weekday cluster and rise, with evidence', () => {
  const monday = (n) => ({ date: d('2026-10-12'), minutes: 540 + n, late: true });
  const out = a.signals({
    coverage: [{ departmentId: 'd1', department: 'R&D', teamSize: 8, limit: 2, days: [{ date: '2026-10-20', approved: 2, pending: 1, names: ['Amal', 'Sami', 'Rim'] }] }],
    lateCurrent: [monday(1), monday(5), monday(9), { date: d('2026-10-14'), minutes: 545, late: true }],
    latePrevious: [],
    missingPunchOuts: 0,
  });
  assert.deepEqual(out.map((s) => s.id), ['coverage:d1', 'lateness:rise', 'lateness:cluster']);
  assert.match(out[0].evidence, /3 of 8 away if 1 pending request is approved \(limit 2\)/);
  assert.match(out[2].title, /Mondays/);
});

test('signals: overtime per person per week, waits and low read rates', () => {
  const out = a.signals({
    hours: [{ id: 'd1', name: 'Production', headcount: 2, overtime: 30 }, { id: 'd2', name: 'Sales', headcount: 4, overtime: 4 }],
    weeks: 4,
    waiting: [{ name: 'Amal', days: 9 }, { name: 'Sami', days: 2 }],
    notifications: { sent: 50, read: 5, byType: [{ label: 'event invitations', sent: 40 }] },
  });
  assert.deepEqual(out.map((s) => s.id), ['leave:waiting', 'overtime:d1', 'engagement:notifications']);
  assert.match(out[1].title, /3.8 h overtime per person per week/);
  assert.match(out[0].title, /^1 leave request has waited/);
  assert.match(out[2].evidence, /event invitations make up 80%/);
});

test('signals: nothing to report gives an empty list', () => {
  assert.deepEqual(a.signals({ notifications: { sent: 5, read: 0, byType: [] } }), []);
});
