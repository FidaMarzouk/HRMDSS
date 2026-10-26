// Calendar tools: find people and free resources, prepare bookings, meetings
// and missions, answer invitations, and (HR only) prepare event decisions.
const Resource = require('../../../Models/Resource');
const CalendarEvent = require('../../../Models/CalendarEvent');
const User = require('../../../Models/User');
const clash = require('../../clash');
const policies = require('../../policies');
const drafts = require('../drafts');
const { z, ToolError, DAY, TIME, ID, at, fmtDay, fmtTime, fmtRange, fullName, findPeopleByName } = require('../common');

const MODELS = { Resource, CalendarEvent };
const RESOURCE_TYPES = ['desktop', 'meetingRoom', 'office', 'robot', 'toolKit', 'testingEquipment', 'prototype'];
const VISIBILITY = z.enum(['public', 'department', 'private']).optional().describe('Who can see it: public (default), department, private (invited people only)');
const isAdmin = (user) => user.role === 'admin' || user.role === 'superAdmin';

// Start/end from company day and times; refuses impossible ranges.
const window = ({ day, from, to, endDay }) => {
  const start = at(day, from);
  const end = at(endDay || day, to);
  if (end <= start) throw new ToolError('The end must be after the start.');
  if (end - start < 10 * 60 * 1000) throw new ToolError('Events last at least 10 minutes.');
  if (end < new Date()) throw new ToolError('That time is already over.');
  return { start, end };
};

// Free / pending / blocked for one resource and time, without revealing other people's private titles.
const availability = async (resourceId, start, end) => {
  const check = await clash.checkBooking({ resourceId, startDateTime: start, endDateTime: end, models: MODELS });
  if (!check.ok) {
    return {
      ok: false,
      reason: check.status === 'resource_maintenance' ? 'under maintenance' : check.status === 'resource_not_found' ? 'not found' : 'already booked (confirmed)',
      busy: (check.conflicts || []).map((c) => `${fmtTime(c.startDateTime)}–${fmtTime(c.endDateTime)}`),
    };
  }
  return { ok: true, pendingRequests: check.clashes.length, resource: check.resource };
};

const people = async (ids = [], selfId) => {
  const unique = [...new Set(ids)].filter((id) => id !== String(selfId));
  if (!unique.length) return [];
  const found = await User.find({ _id: { $in: unique }, ...User.ACTIVE }).select('firstName lastName').lean();
  if (found.length !== unique.length) throw new ToolError('Some invitees were not found or have left: look them up again with find_people.');
  return found;
};

const approvalCheck = (user) =>
  isAdmin(user)
    ? { tone: 'info', text: 'Created by HR or the CEO: it is confirmed straight away.' }
    : { tone: 'info', text: 'HR approves it after you create it.' };

module.exports = [
  {
    name: 'find_people',
    skill: 'core',
    effect: 'read',
    description: 'Find active colleagues by name (first and/or last name) to invite them, write to them or find their requests. Returns ids, positions and departments.',
    schema: z.object({ name: z.string().min(2).max(60) }),
    handler: async (ctx, a) => ({ people: await findPeopleByName(a.name, { excludeId: ctx.user.id }) }),
  },
  {
    name: 'list_resources',
    skill: 'calendar',
    effect: 'read',
    description: 'List bookable resources (meeting rooms, offices, desks, tool kits, testing equipment, robots, prototypes), optionally of one type, with maintenance status.',
    schema: z.object({ type: z.enum(RESOURCE_TYPES).optional() }),
    handler: async (ctx, a) => {
      const rows = await Resource.find(a.type ? { type: a.type } : {}).sort({ type: 1, name: 1 }).lean();
      return { resources: rows.map((r) => ({ id: String(r._id), name: r.name, type: r.type, underMaintenance: r.status === 'maintenance' })) };
    },
  },
  {
    name: 'find_free_resources',
    skill: 'calendar',
    effect: 'read',
    description:
      'Which resources of a type are free for a time slot. A resource is free when no confirmed booking overlaps; pendingRequests counts other requests waiting for HR at that time (still bookable, HR picks one).',
    schema: z.object({ type: z.enum(RESOURCE_TYPES), day: DAY, from: TIME, to: TIME }),
    handler: async (ctx, a) => {
      const { start, end } = window(a);
      const rows = await Resource.find({ type: a.type }).sort({ name: 1 }).lean();
      const out = await Promise.all(rows.map(async (r) => ({ id: String(r._id), name: r.name, ...(await availability(r._id, start, end)) })));
      return {
        slot: `${fmtDay(start)} ${a.from}–${a.to}`,
        free: out.filter((r) => r.ok).map((r) => ({ id: r.id, name: r.name, pendingRequests: r.pendingRequests })),
        unavailable: out.filter((r) => !r.ok).map((r) => ({ id: r.id, name: r.name, reason: r.reason, busy: r.busy })),
      };
    },
  },
  {
    name: 'prepare_booking',
    skill: 'calendar',
    effect: 'prepare',
    description: 'Prepare booking a resource (room, desk, kit, robot, prototype...) for a time slot. Refuses when a confirmed booking overlaps or the resource is under maintenance.',
    schema: z.object({ resourceId: ID, title: z.string().min(3).max(120), day: DAY, from: TIME, to: TIME, endDay: DAY.optional(), description: z.string().max(1000).optional(), visibility: VISIBILITY }),
    handler: async (ctx, a) => {
      const { start, end } = window(a);
      const free = await availability(a.resourceId, start, end);
      if (!free.ok) throw new ToolError(`That resource is ${free.reason}${free.busy?.length ? ` (${free.busy.join(', ')})` : ''}. Try find_free_resources for another one or another time.`);
      return drafts.create(ctx, {
        kind: 'booking',
        title: `Book ${free.resource.name} · ${fmtDay(start)} ${fmtTime(start)}–${fmtTime(end)}`,
        details: [
          { label: 'Resource', value: free.resource.name },
          { label: 'When', value: `${fmtRange(start, end)}, ${fmtTime(start)}–${fmtTime(end)}` },
          { label: 'Title', value: a.title },
          { label: 'Visible to', value: a.visibility || 'public' },
        ],
        checks: [
          { tone: 'ok', text: 'No confirmed booking overlaps.' },
          ...(free.pendingRequests ? [{ tone: 'warn', text: `${free.pendingRequests} other request${free.pendingRequests === 1 ? ' is' : 's are'} pending for that time: HR approves one of them.` }] : []),
          approvalCheck(ctx.user),
        ],
        payload: { eventType: 'resourceReservation', resource: a.resourceId, title: a.title, description: a.description || '', startDateTime: start.toISOString(), endDateTime: end.toISOString(), visibility: a.visibility || 'public' },
      });
    },
  },
  {
    name: 'prepare_meeting',
    skill: 'calendar',
    effect: 'prepare',
    description:
      'Prepare a meeting: title, time, description, invitees (ids from find_people), and either a room (id of a meetingRoom or office, checked for clashes) or a free-text location.',
    schema: z.object({
      title: z.string().min(3).max(120),
      day: DAY,
      from: TIME,
      to: TIME,
      description: z.string().min(3).max(1000),
      roomId: ID.optional(),
      location: z.string().max(120).optional(),
      inviteeIds: z.array(ID).max(30).optional(),
      visibility: VISIBILITY,
    }),
    handler: async (ctx, a) => {
      const { start, end } = window(a);
      if (!a.roomId && !a.location) throw new ToolError('A meeting needs a room or a location.');
      let room = null;
      let pending = 0;
      if (a.roomId) {
        const free = await availability(a.roomId, start, end);
        if (!free.ok) throw new ToolError(`That room is ${free.reason}${free.busy?.length ? ` (${free.busy.join(', ')})` : ''}. Try find_free_resources with type meetingRoom.`);
        if (!['meetingRoom', 'office'].includes(free.resource.type)) throw new ToolError('Only a meeting room or an office can host a meeting.');
        room = free.resource;
        pending = free.pendingRequests;
      }
      const invitees = await people(a.inviteeIds, ctx.user.id);
      return drafts.create(ctx, {
        kind: 'meeting',
        title: `${a.title} · ${fmtDay(start)} ${fmtTime(start)}–${fmtTime(end)}`,
        details: [
          { label: 'When', value: `${fmtDay(start)}, ${fmtTime(start)}–${fmtTime(end)}` },
          { label: 'Where', value: room ? room.name : a.location },
          { label: 'Invited', value: invitees.length ? invitees.map(fullName).join(', ') : 'Nobody yet' },
          { label: 'Visible to', value: a.visibility || 'public' },
        ],
        checks: [
          ...(room ? [{ tone: 'ok', text: `${room.name} has no confirmed booking at that time.` }] : []),
          ...(pending ? [{ tone: 'warn', text: `${pending} other request${pending === 1 ? ' is' : 's are'} pending for the room at that time.` }] : []),
          approvalCheck(ctx.user),
        ],
        payload: {
          eventType: 'meeting',
          title: a.title,
          description: a.description,
          location: a.location || room?.name,
          ...(room ? { resource: a.roomId } : {}),
          startDateTime: start.toISOString(),
          endDateTime: end.toISOString(),
          visibility: a.visibility || 'public',
          usersInvolved: invitees.map((p) => String(p._id)),
        },
      });
    },
  },
  {
    name: 'prepare_mission',
    skill: 'calendar',
    effect: 'prepare',
    description: 'Prepare a mission (work travel or on-site intervention): title, description, destination, start and end, and the colleagues taking part.',
    schema: z.object({
      title: z.string().min(3).max(120),
      day: DAY,
      from: TIME,
      endDay: DAY.optional(),
      to: TIME,
      description: z.string().min(3).max(1000),
      destination: z.string().min(2).max(120),
      participantIds: z.array(ID).max(30).optional(),
      visibility: VISIBILITY,
    }),
    handler: async (ctx, a) => {
      const { start, end } = window(a);
      const participants = await people(a.participantIds, ctx.user.id);
      return drafts.create(ctx, {
        kind: 'mission',
        title: `${a.title} · ${fmtRange(start, end)}`,
        details: [
          { label: 'When', value: `${fmtRange(start, end)}, ${fmtTime(start)}–${fmtTime(end)}` },
          { label: 'Destination', value: a.destination },
          { label: 'With', value: participants.length ? participants.map(fullName).join(', ') : 'Only you' },
        ],
        checks: [approvalCheck(ctx.user)],
        payload: {
          eventType: 'mission',
          title: a.title,
          description: a.description,
          destination: a.destination,
          startDateTime: start.toISOString(),
          endDateTime: end.toISOString(),
          visibility: a.visibility || 'department',
          usersInvolved: participants.map((p) => String(p._id)),
        },
      });
    },
  },
  {
    name: 'list_my_invitations',
    skill: 'calendar',
    effect: 'read',
    description: 'Upcoming events the current person is invited to and has not answered yet.',
    schema: z.object({}),
    handler: async (ctx) => {
      const rows = await CalendarEvent.find({ startDateTime: { $gte: new Date() }, status: { $ne: 'declined' }, usersInvolved: { $elemMatch: { userId: ctx.user.id, status: 'pending' } } })
        .sort({ startDateTime: 1 })
        .limit(15)
        .populate('createdBy', 'firstName lastName')
        .lean();
      return { invitations: rows.map((e) => ({ id: String(e._id), title: e.title, type: e.eventType, when: `${fmtDay(e.startDateTime)} ${fmtTime(e.startDateTime)}–${fmtTime(e.endDateTime)}`, organiser: fullName(e.createdBy) })) };
    },
  },
  {
    name: 'prepare_invitation_response',
    skill: 'calendar',
    effect: 'prepare',
    description: 'Prepare accepting or declining an event invitation addressed to the current person.',
    schema: z.object({ eventId: ID, accept: z.boolean() }),
    handler: async (ctx, a) => {
      const event = await CalendarEvent.findOne({ _id: a.eventId, 'usersInvolved.userId': ctx.user.id }).populate('createdBy', 'firstName lastName').lean();
      if (!event) throw new ToolError('The current person is not invited to that event.');
      return drafts.create(ctx, {
        kind: 'invitation_response',
        title: `${a.accept ? 'Accept' : 'Decline'} "${event.title}"`,
        details: [
          { label: 'Event', value: event.title },
          { label: 'When', value: `${fmtDay(event.startDateTime)} ${fmtTime(event.startDateTime)}–${fmtTime(event.endDateTime)}` },
          { label: 'Organiser', value: fullName(event.createdBy) },
        ],
        checks: [{ tone: 'info', text: 'The organiser is notified of your answer.' }],
        payload: { eventId: a.eventId, status: a.accept ? 'accepted' : 'declined' },
      });
    },
  },
  {
    name: 'list_events_waiting_on_me',
    skill: 'calendar',
    effect: 'read',
    roles: ['admin'],
    description: 'Pending meetings, missions and bookings waiting for HR approval, with clashes.',
    schema: z.object({}),
    handler: async () => {
      const rows = await CalendarEvent.find({ status: 'pending', endDateTime: { $gte: new Date() } }).sort({ startDateTime: 1 }).limit(20).populate('createdBy', 'firstName lastName').populate('resource', 'name').lean();
      return {
        events: await Promise.all(
          rows.map(async (e) => {
            const check = e.resource ? await clash.checkBooking({ resourceId: e.resource._id, startDateTime: e.startDateTime, endDateTime: e.endDateTime, excludeId: e._id, models: MODELS }) : { ok: true, clashes: [] };
            return { id: String(e._id), title: e.title, type: e.eventType, by: fullName(e.createdBy), when: `${fmtDay(e.startDateTime)} ${fmtTime(e.startDateTime)}–${fmtTime(e.endDateTime)}`, resource: e.resource?.name || null, blockedByConfirmedBooking: !check.ok, pendingClashes: check.ok ? check.clashes.length : 0 };
          })
        ),
      };
    },
  },
  {
    name: 'prepare_event_decision',
    skill: 'calendar',
    effect: 'prepare',
    roles: ['admin'],
    description: 'Prepare approving or declining a pending event (HR reviewers only). Approving is refused while a confirmed booking overlaps it.',
    schema: z.object({ eventId: ID, approve: z.boolean() }),
    handler: async (ctx, a) => {
      if (!policies.canReviewEvents(ctx.user)) throw new ToolError('Only HR reviews events.');
      const event = await CalendarEvent.findById(a.eventId).populate('createdBy', 'firstName lastName').populate('resource', 'name').lean();
      if (!event || event.status !== 'pending') throw new ToolError('That event is not waiting for a decision.');
      if (a.approve && event.resource) {
        const check = await clash.checkBooking({ resourceId: event.resource._id, startDateTime: event.startDateTime, endDateTime: event.endDateTime, excludeId: event._id, models: MODELS });
        if (!check.ok) throw new ToolError(`It cannot be approved: ${check.message}.`);
      }
      return drafts.create(ctx, {
        kind: 'event_decision',
        title: `${a.approve ? 'Approve' : 'Decline'} "${event.title}"`,
        details: [
          { label: 'Event', value: event.title },
          { label: 'By', value: fullName(event.createdBy) },
          { label: 'When', value: `${fmtDay(event.startDateTime)} ${fmtTime(event.startDateTime)}–${fmtTime(event.endDateTime)}` },
          ...(event.resource ? [{ label: 'Resource', value: event.resource.name }] : []),
        ],
        checks: [{ tone: 'info', text: 'The organiser and invitees are notified.' }],
        payload: { eventId: a.eventId, status: a.approve ? 'approved' : 'declined' },
      });
    },
  },
];
