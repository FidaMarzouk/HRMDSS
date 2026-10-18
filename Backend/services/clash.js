// Booking clashes: two bookings of the same resource whose times overlap.
// Rules (Phase 7):
//  - A booking may not overlap a confirmed (approved) booking: create, move and
//    approve are refused with 409 and the conflicting bookings.
//  - Overlapping requests that are still pending are allowed, and shown as a
//    clash so the reviewer decides; approving one then blocks the others.
//  - A resource under maintenance cannot be booked.
const mongoose = require('mongoose');
const { idOf } = require('./policies');

const fullName = (u) => (u && typeof u === 'object' ? `${u.firstName || ''} ${u.lastName || ''}`.trim() : '');

// Half-open intervals: a booking ending at 10:00 does not clash with one starting at 10:00.
const overlaps = (a, b) => new Date(a.startDateTime) < new Date(b.endDateTime) && new Date(b.startDateTime) < new Date(a.endDateTime);

// Other live bookings of the same resource that overlap `event`.
const clashesOf = (event, others) =>
  event.resource
    ? others.filter(
        (o) =>
          idOf(o._id) !== idOf(event._id) &&
          o.resource &&
          idOf(o.resource) === idOf(event.resource) &&
          o.status !== 'declined' &&
          overlaps(o, event)
      )
    : [];

// The clashes that block: confirmed bookings.
const blocking = (clashes) => clashes.filter((c) => c.status === 'approved');

// How a booking is drawn. A pending request that overlaps any live booking is
// a clash (the reviewer must choose). A confirmed booking stays confirmed when
// only pending requests overlap it; it is a clash only when another confirmed
// booking overlaps it (a real double booking, e.g. from before Phase 7).
const bookingState = (event, clashes) => {
  if (event.status === 'declined') return 'declined';
  if (event.status === 'approved') return blocking(clashes).length ? 'clash' : 'confirmed';
  return clashes.length ? 'clash' : 'pending';
};

// Short description of a conflicting booking for API responses.
const describe = (e) => ({
  id: idOf(e._id),
  title: e.title,
  startDateTime: e.startDateTime,
  endDateTime: e.endDateTime,
  status: e.status,
  by: fullName(e.createdBy),
});

/**
 * Check a booking before it is saved or approved.
 * Returns { ok: true, resource, clashes } (clashes = overlapping pending requests)
 * or { ok: false, httpStatus, status, message, conflicts }.
 */
const checkBooking = async ({ resourceId, startDateTime, endDateTime, excludeId, models }) => {
  const { Resource, CalendarEvent } = models;
  if (!resourceId) return { ok: true, clashes: [] };
  const resource = mongoose.isValidObjectId(resourceId) ? await Resource.findById(resourceId).lean() : null;
  if (!resource) return { ok: false, httpStatus: 404, status: 'resource_not_found', message: 'Resource not found', conflicts: [] };
  if (resource.status === 'maintenance') {
    return { ok: false, httpStatus: 409, status: 'resource_maintenance', message: `${resource.name} is under maintenance`, conflicts: [] };
  }
  const query = {
    resource: resource._id,
    status: { $ne: 'declined' },
    startDateTime: { $lt: new Date(endDateTime) },
    endDateTime: { $gt: new Date(startDateTime) },
  };
  if (excludeId && mongoose.isValidObjectId(excludeId)) query._id = { $ne: excludeId };
  const others = await CalendarEvent.find(query).populate('createdBy', 'firstName lastName').lean();
  const confirmed = blocking(others);
  if (confirmed.length) {
    return {
      ok: false,
      httpStatus: 409,
      status: 'resource_conflict',
      message: `${resource.name} is already booked at that time`,
      conflicts: confirmed.map(describe),
    };
  }
  return { ok: true, resource, clashes: others.map(describe) };
};

module.exports = { overlaps, clashesOf, blocking, bookingState, describe, checkBooking };
