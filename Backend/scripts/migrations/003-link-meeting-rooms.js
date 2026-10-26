// Meetings named their room only in free text ("Meeting Room A — Atlas"), so
// room bookings and meetings in the same room were never compared. Meetings
// can now hold the room itself (CalendarEvent.resource); this links existing
// meetings whose location is exactly the name of a meeting room or office.
// Overlaps this reveals are reported, not changed: they show as clashes.
const ROOM_TYPES = ['meetingRoom', 'office'];
const norm = (s) => String(s || '').trim().toLowerCase();

module.exports = {
  description: 'Link meetings to the room named in their location',

  async up({ db, dryRun, log }) {
    const rooms = await db.collection('resources').find({ type: { $in: ROOM_TYPES } }, { projection: { name: 1 } }).toArray();
    const byName = new Map(rooms.map((r) => [norm(r.name), r._id]));
    const events = db.collection('calendarevents');
    const ops = [];
    const linked = [];
    for await (const e of events.find({ eventType: 'meeting', resource: { $in: [null] }, location: { $nin: [null, ''] } }, { projection: { location: 1, startDateTime: 1, endDateTime: 1, status: 1 } })) {
      const roomId = byName.get(norm(e.location));
      if (!roomId) continue;
      ops.push({ updateOne: { filter: { _id: e._id }, update: { $set: { resource: roomId } } } });
      linked.push({ ...e, resource: roomId });
    }

    // Overlaps with other live bookings of the same room (already linked, or
    // linked by this migration), for the log only; each pair is counted once.
    const live = linked.filter((x) => x.status !== 'declined');
    let overlaps = 0;
    const doubleBooked = new Set();
    live.forEach((e, i) => {
      live.slice(i + 1).forEach((o) => {
        if (String(o.resource) === String(e.resource) && o.startDateTime < e.endDateTime && e.startDateTime < o.endDateTime) {
          overlaps++;
          if (e.status === 'approved' && o.status === 'approved') doubleBooked.add(String(e.resource));
        }
      });
    });
    for (const e of live) {
      overlaps += await events.countDocuments({
        resource: e.resource,
        status: { $ne: 'declined' },
        startDateTime: { $lt: e.endDateTime },
        endDateTime: { $gt: e.startDateTime },
      });
    }

    log(`meetings: ${ops.length} linked to a room ${dryRun ? '(would change)' : '(updated)'}; ${overlaps} overlapping pair(s) will show as clashes${doubleBooked.size ? ` (confirmed double bookings in ${doubleBooked.size} room(s))` : ''}`);
    if (!dryRun && ops.length) await events.bulkWrite(ops, { ordered: false });
    return { meetings: ops.length, overlaps, doubleBookedRooms: doubleBooked.size };
  },
};
