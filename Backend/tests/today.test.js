process.env.TZ = 'Africa/Tunis';
const test = require('node:test');
const assert = require('node:assert/strict');
const t = require('../services/today');
const policies = require('../services/policies');

const NOW = new Date('2026-10-15T13:43:00+01:00'); // Thursday
const day = (s) => new Date(`${s}T00:00:00+01:00`);
const person = (id, first, last) => ({ _id: id, firstName: first, lastName: last });

const rania = { _id: 'r1', employeeId: person('u1', 'Rania', 'Trabelsi'), startDate: day('2026-11-24'), endDate: day('2026-11-27'), reason: 'Vacation Leave', status: 'Pending' };

test('overlap is reported on the first shared working day, ignoring the same person and rejected requests', () => {
  const team = [
    rania,
    { _id: 'r2', employeeId: person('u2', 'Rim', 'Ferchichi'), startDate: day('2026-11-25'), endDate: day('2026-11-26'), status: 'Admin Approved' },
    { _id: 'r3', employeeId: person('u3', 'Haythem', 'Bouazizi'), startDate: day('2026-11-20'), endDate: day('2026-11-25'), status: 'Pending' },
    { _id: 'r4', employeeId: person('u4', 'Emna', 'Gharbi'), startDate: day('2026-11-24'), endDate: day('2026-11-27'), status: 'Admin Rejected' },
    { _id: 'r5', employeeId: person('u1', 'Rania', 'Trabelsi'), startDate: day('2026-11-24'), endDate: day('2026-11-24'), status: 'Pending' },
  ];
  const found = t.leaveOverlaps(rania, team);
  assert.deepEqual(found.map((o) => o.other._id), ['r3', 'r2']);
  assert.equal(found[0].day.getDate(), 24);
});

test('a weekend-only overlap is not an overlap', () => {
  const fri = { _id: 'a', employeeId: 'x', startDate: day('2026-10-16'), endDate: day('2026-10-18') }; // Fri–Sun
  const weekend = { _id: 'b', employeeId: 'y', startDate: day('2026-10-17'), endDate: day('2026-10-18'), status: 'Admin Approved' };
  assert.equal(t.firstSharedWorkday(fri, weekend), null);
});

test('leave queue items carry overlap and "starts soon" flags and the role-specific approve URL', () => {
  const soon = { ...rania, _id: 's1', startDate: day('2026-10-20'), endDate: day('2026-10-20') };
  const item = t.leaveQueueItem(soon, [], policies.LEAVE_REVIEW_PATH.admin, NOW);
  assert.deepEqual(item.flags, [{ tone: 'amber', label: 'Starts in 5 days' }]);
  assert.equal(item.approve.url, '/api/leave-requests/admin/s1/approve');

  const withOverlap = t.leaveQueueItem(rania, [{ other: { employeeId: person('u2', 'Rim', 'F') }, day: day('2026-11-25') }], 'manager', NOW);
  assert.equal(withOverlap.flags[0].tone, 'red');
  assert.equal(withOverlap.flags[0].label, 'Overlap 25 Nov');
});

test('bookings of the same resource clash only when their times overlap and neither is declined', () => {
  const base = { _id: 'e1', resource: 'robot', status: 'pending', startDateTime: new Date('2026-10-22T09:30:00+01:00'), endDateTime: new Date('2026-10-22T12:00:00+01:00') };
  const others = [
    { _id: 'e2', resource: 'robot', status: 'pending', startDateTime: new Date('2026-10-22T10:00:00+01:00'), endDateTime: new Date('2026-10-22T11:30:00+01:00') },
    { _id: 'e3', resource: 'robot', status: 'declined', startDateTime: new Date('2026-10-22T10:00:00+01:00'), endDateTime: new Date('2026-10-22T11:00:00+01:00') },
    { _id: 'e4', resource: 'robot', status: 'approved', startDateTime: new Date('2026-10-22T13:00:00+01:00'), endDateTime: new Date('2026-10-22T14:00:00+01:00') },
    { _id: 'e5', resource: 'scope', status: 'approved', startDateTime: new Date('2026-10-22T10:00:00+01:00'), endDateTime: new Date('2026-10-22T11:00:00+01:00') },
  ];
  assert.deepEqual(t.eventClashes(base, others).map((e) => e._id), ['e2']);
});

test('queue is ordered by deadline, red flags first on the same day', () => {
  const items = [
    { id: 'late', deadline: day('2026-11-02'), flags: [] },
    { id: 'plain', deadline: day('2026-10-20'), flags: [{ tone: 'amber' }] },
    { id: 'red', deadline: day('2026-10-20'), flags: [{ tone: 'red' }] },
  ];
  assert.deepEqual(t.sortQueue(items).map((i) => i.id), ['red', 'plain', 'late']);
});

test('presence status covers in, late, left, leave, mission, absent and not in', () => {
  const at = (h, m) => new Date(`2026-10-15T${h}:${m}:00+01:00`);
  assert.equal(t.presenceStatus({ sessions: [{ checkIn: at('08', '04'), status: 'Present' }] }), 'in');
  assert.equal(t.presenceStatus({ sessions: [{ checkIn: at('08', '49'), status: 'Late' }] }), 'late');
  assert.equal(t.presenceStatus({ sessions: [{ checkIn: at('08', '02'), checkOut: at('17', '08'), status: 'Present' }] }), 'left');
  // Back from lunch: a second open session keeps the person "in", judged by the first session
  assert.equal(t.presenceStatus({ sessions: [{ checkIn: at('08', '50'), checkOut: at('12', '30'), status: 'Late' }, { checkIn: at('13', '30'), status: 'Present' }] }), 'late');
  assert.equal(t.presenceStatus({ sessions: [], onLeave: true }), 'leave');
  assert.equal(t.presenceStatus({ sessions: [], onMission: true }), 'mission');
  assert.equal(t.presenceStatus({ sessions: [{ status: 'Absent' }] }), 'absent');
  assert.equal(t.presenceStatus({ sessions: [] }), 'out');
});

test('summary counts people in the building, late, away and not in', () => {
  const s = t.summarizePresence([
    { status: 'in' }, { status: 'late', lateToday: true }, { status: 'left', lateToday: true }, { status: 'leave' }, { status: 'mission' }, { status: 'out' },
  ]);
  assert.deepEqual(s, { total: 6, in: 2, late: 2, away: 2, left: 1, out: 1 });
});

test('policies: each role reviews only the requests the controllers allow', () => {
  const req = (over) => ({ employeeId: 'e', managerId: 'm', status: 'Pending', createdBy: 'Employee', ...over });
  assert.equal(policies.canReviewLeave({ id: 'm', role: 'manager' }, req()), true);
  assert.equal(policies.canReviewLeave({ id: 'm', role: 'manager' }, req({ status: 'Manager Approved' })), false);
  assert.equal(policies.canReviewLeave({ id: 'h', role: 'admin' }, req({ status: 'Manager Approved' })), true);
  assert.equal(policies.canReviewLeave({ id: 'h', role: 'admin' }, req({ createdBy: 'Admin' })), false);
  assert.equal(policies.canReviewLeave({ id: 'c', role: 'superAdmin' }, req({ createdBy: 'Admin' })), true);
  assert.equal(policies.canReviewLeave({ id: 'e', role: 'admin' }, req()), false); // never your own
  assert.equal(policies.leaveQueueFilter({ id: 'e', role: 'employee' }), null);
});
