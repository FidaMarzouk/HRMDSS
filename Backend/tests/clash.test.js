process.env.TZ = 'Africa/Tunis';
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const clash = require('../services/clash');

const at = (hm) => new Date(`2026-10-22T${hm}:00+01:00`);
const booking = (id, status, from, to, resource = 'robot') => ({ _id: id, resource, status, startDateTime: at(from), endDateTime: at(to), title: id, createdBy: { firstName: 'Rim', lastName: 'Ferchichi' } });

test('overlap is half-open: back-to-back bookings do not clash', () => {
  assert.equal(clash.overlaps(booking('a', 'approved', '09:00', '10:00'), booking('b', 'pending', '10:00', '11:00')), false);
  assert.equal(clash.overlaps(booking('a', 'approved', '09:00', '10:01'), booking('b', 'pending', '10:00', '11:00')), true);
  assert.equal(clash.overlaps(booking('a', 'approved', '08:00', '12:00'), booking('b', 'pending', '10:00', '11:00')), true);
});

test('clashes: same resource, overlapping, not declined, not itself', () => {
  const e = booking('e1', 'pending', '09:30', '12:00');
  const others = [e, booking('e2', 'pending', '10:00', '11:30'), booking('e3', 'declined', '10:00', '11:00'), booking('e4', 'approved', '12:00', '14:00'), booking('e5', 'approved', '10:00', '11:00', 'scope')];
  assert.deepEqual(clash.clashesOf(e, others).map((x) => x._id), ['e2']);
  assert.deepEqual(clash.clashesOf({ ...e, resource: undefined }, others), []);
});

test('state: confirmed, pending, clash; only confirmed bookings block', () => {
  const pending = booking('p', 'pending', '09:00', '10:00');
  const approved = booking('a', 'approved', '09:30', '10:30');
  assert.equal(clash.bookingState(approved, []), 'confirmed');
  assert.equal(clash.bookingState(pending, []), 'pending');
  assert.equal(clash.bookingState(pending, [approved]), 'clash');
  assert.equal(clash.bookingState(approved, [pending]), 'confirmed'); // pending requests do not stain a confirmed booking
  assert.equal(clash.bookingState(approved, [booking('a2', 'approved', '10:00', '11:00')]), 'clash'); // double booking
  assert.deepEqual(clash.blocking([pending, approved]).map((x) => x._id), ['a']);
});

// Minimal stand-ins for the Mongoose models used by checkBooking.
const fakeModels = (resource, rows) => ({
  Resource: { findById: () => ({ lean: async () => resource }) },
  CalendarEvent: {
    find: (q) => ({
      populate: () => ({
        lean: async () =>
          rows.filter(
            (r) =>
              r.status !== 'declined' &&
              (!q._id || String(r._id) !== String(q._id.$ne)) &&
              r.startDateTime < q.startDateTime.$lt &&
              r.endDateTime > q.endDateTime.$gt
          ),
      }),
    }),
  },
});
const rid = new mongoose.Types.ObjectId();

test('checkBooking refuses a confirmed overlap with 409 and lists it', async () => {
  const models = fakeModels({ _id: rid, name: 'PGuard Unit 01', status: 'available' }, [booking('a', 'approved', '09:00', '11:00', rid)]);
  const r = await clash.checkBooking({ resourceId: rid, startDateTime: at('10:00'), endDateTime: at('12:00'), models });
  assert.equal(r.ok, false);
  assert.equal(r.httpStatus, 409);
  assert.equal(r.status, 'resource_conflict');
  assert.deepEqual(r.conflicts.map((c) => [c.id, c.by]), [['a', 'Rim Ferchichi']]);
});

test('checkBooking allows overlapping pending requests and reports them; the booking itself is excluded', async () => {
  const self = new mongoose.Types.ObjectId();
  const models = fakeModels({ _id: rid, name: 'PGuard Unit 01', status: 'available' }, [booking('p', 'pending', '09:00', '11:00', rid), booking(self, 'approved', '10:00', '12:00', rid)]);
  const r = await clash.checkBooking({ resourceId: rid, startDateTime: at('10:00'), endDateTime: at('12:00'), excludeId: String(self), models });
  assert.equal(r.ok, true);
  assert.deepEqual(r.clashes.map((c) => c.id), ['p']);
});

test('checkBooking refuses resources under maintenance and unknown resources', async () => {
  const down = await clash.checkBooking({ resourceId: rid, startDateTime: at('10:00'), endDateTime: at('11:00'), models: fakeModels({ _id: rid, name: 'Test Chamber', status: 'maintenance' }, []) });
  assert.equal(down.status, 'resource_maintenance');
  assert.equal(down.httpStatus, 409);
  const missing = await clash.checkBooking({ resourceId: 'nope', startDateTime: at('10:00'), endDateTime: at('11:00'), models: fakeModels(null, []) });
  assert.equal(missing.httpStatus, 404);
});
