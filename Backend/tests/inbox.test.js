process.env.TZ = 'Africa/Tunis';
const test = require('node:test');
const assert = require('node:assert/strict');
const inbox = require('../services/inbox');
const { coarse } = require('../services/presence');

const NOW = new Date('2026-10-19T10:00:00+01:00');
const day = (s) => new Date(`${s}T00:00:00+01:00`);
const ids = (actions) => actions.map((a) => a.id);
const emp = { id: 'u1', role: 'employee' };
const mgr = { id: 'm1', role: 'manager' };
const hr = { id: 'h1', role: 'admin' };
const ceo = { id: 'c1', role: 'superAdmin' };

const leave = (extra = {}) => ({ _id: 'l1', employeeId: 'u1', managerId: 'm1', createdBy: 'Employee', status: 'Pending', reason: 'Vacation Leave', startDate: day('2026-11-02'), endDate: day('2026-11-03'), ...extra });

test('notification types map to the item they refer to', () => {
  assert.equal(inbox.kindOfType('leave_request'), 'leave');
  assert.equal(inbox.kindOfType('leave_approved'), 'leave');
  assert.equal(inbox.kindOfType('event_invitation'), 'event');
  assert.equal(inbox.kindOfType('attendance_correction'), 'correction');
  assert.equal(inbox.kindOfType('digest'), null);
});

test('leave: the reviewer whose turn it is can approve; others and the requester cannot', () => {
  assert.deepEqual(ids(inbox.actionsFor('leave', leave(), mgr)), ['approve']);
  assert.match(inbox.actionsFor('leave', leave(), mgr)[0].url, /\/manager\/l1\/approve$/);
  assert.deepEqual(ids(inbox.actionsFor('leave', leave(), hr)), ['approve']); // HR may decide employee requests directly
  assert.deepEqual(ids(inbox.actionsFor('leave', leave(), emp)), []);
  assert.deepEqual(ids(inbox.actionsFor('leave', leave(), ceo)), []);
  assert.deepEqual(ids(inbox.actionsFor('leave', leave({ status: 'Manager Approved' }), mgr)), []); // done for the manager
  assert.deepEqual(ids(inbox.actionsFor('leave', leave({ status: 'Admin Approved' }), hr)), []);
});

test('leave: an open counter-proposal waits on the requester, not the reviewer', () => {
  const proposed = leave({ counterProposal: { status: 'open', startDate: day('2026-11-09'), endDate: day('2026-11-10') } });
  assert.deepEqual(ids(inbox.actionsFor('leave', proposed, emp)), ['accept_dates', 'keep_dates']);
  assert.deepEqual(ids(inbox.actionsFor('leave', proposed, mgr)), []);
});

test('events: HR reviews pending ones; invited people answer once; nothing after the event', () => {
  const event = { _id: 'e1', status: 'pending', createdBy: 'u2', startDateTime: new Date('2026-12-01T09:00:00+01:00'), endDateTime: new Date('2026-12-01T10:00:00+01:00'), usersInvolved: [{ userId: 'u1', status: 'pending' }] };
  assert.deepEqual(ids(inbox.actionsFor('event', event, hr)), ['approve', 'decline']);
  assert.deepEqual(ids(inbox.actionsFor('event', event, emp)), ['accept', 'decline_invite']);
  assert.deepEqual(ids(inbox.actionsFor('event', { ...event, usersInvolved: [{ userId: 'u1', status: 'accepted' }] }, emp)), []);
  assert.deepEqual(ids(inbox.actionsFor('event', { ...event, status: 'approved' }, hr)), []);
  const past = { ...event, startDateTime: new Date('2020-01-01T09:00:00Z'), endDateTime: new Date('2020-01-01T10:00:00Z') };
  assert.deepEqual(ids(inbox.actionsFor('event', past, hr)), []);
});

test('corrections: only the reviewer of a pending correction can approve', () => {
  const c = { _id: 'k1', userId: 'u1', reviewerId: 'm1', requesterRole: 'employee', status: 'pending' };
  assert.deepEqual(ids(inbox.actionsFor('correction', c, mgr)), ['approve']);
  assert.deepEqual(ids(inbox.actionsFor('correction', c, emp)), []);
  assert.deepEqual(ids(inbox.actionsFor('correction', { ...c, status: 'approved' }, mgr)), []);
});

test('priority: soon-starting or sick/emergency items to act on are urgent; the rest is normal', () => {
  assert.equal(inbox.priorityOf('leave', leave({ startDate: day('2026-10-20') }), { actionable: true, now: NOW }), 'urgent');
  assert.equal(inbox.priorityOf('leave', leave({ reason: 'Sick Leave' }), { actionable: true, now: NOW }), 'urgent');
  assert.equal(inbox.priorityOf('leave', leave(), { actionable: true, now: NOW }), 'normal');
  assert.equal(inbox.priorityOf('leave', leave({ status: 'Admin Approved', startDate: day('2026-10-21') }), { actionable: false, now: NOW }), 'urgent');
  assert.equal(inbox.priorityOf('event', { startDateTime: new Date('2026-10-19T15:00:00+01:00') }, { actionable: true, now: NOW }), 'urgent');
  assert.equal(inbox.priorityOf('event', { startDateTime: new Date('2026-10-30T15:00:00+01:00') }, { actionable: true, now: NOW }), 'normal');
  assert.equal(inbox.priorityOf(null, null), 'normal');
});

test('cards hide what the viewer may not see', () => {
  const card = inbox.cardFor('leave', leave(), { id: 'x9', role: 'employee' });
  assert.equal(card.hidden, true);
  const mine = inbox.cardFor('leave', { ...leave(), employeeId: { _id: 'u1', firstName: 'Rim', lastName: 'Ferchichi' } }, emp);
  assert.equal(mine.title, 'Rim Ferchichi');
  assert.match(mine.detail, /2 working days/);
  assert.equal(mine.status, 'Pending');
  assert.equal(inbox.cardFor('event', null, emp).missing, true);
});

test('digest summary counts updates by kind and what still needs action', () => {
  const msg = inbox.digestMessage([
    { type: 'leave_approved' },
    { type: 'leave_request', actionable: true, doneAt: null },
    { type: 'event_invitation' },
  ]);
  assert.equal(msg, '3 updates since your last digest: 2 leave updates, 1 calendar update. 1 still needs your action.');
});

test('presence outside your scope is coarse: in, away or out', () => {
  assert.deepEqual(coarse({ status: 'late', since: new Date() }), { status: 'in' });
  assert.deepEqual(coarse({ status: 'leave' }), { status: 'away' });
  assert.deepEqual(coarse({ status: 'mission' }), { status: 'away' });
  assert.deepEqual(coarse({ status: 'left' }), { status: 'out' });
});
