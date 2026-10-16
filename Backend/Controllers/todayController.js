// Today view, presence, sidebar counts and people search for the app shell.
const User = require('../Models/User');
const LeaveRequest = require('../Models/LeaveRequest');
const Attendance = require('../Models/Attendance');
const CalendarEvent = require('../Models/CalendarEvent');
const Notification = require('../Models/Notification');
const Chat = require('../Models/TeamChat');
const { FINAL_APPROVED, IN_PROGRESS } = require('../constants/leave');
const { todayBoundaries, startOfDay } = require('../utils/time');
const policies = require('../services/policies');
const today = require('../services/today');

const PERSON_FIELDS = 'firstName lastName profilePicture departmentId';
const idOf = policies.idOf;

const loadMe = (req) => User.findById(req.user.id).select('firstName role departmentId remainingLeaveDays').lean();

// --- Presence ---------------------------------------------------------------

// People in the user's scope with today's status, grouped by department.
const computePresence = async (user, me, now = new Date()) => {
  const people = await User.find(policies.presenceScope(user, me?.departmentId))
    .select('firstName lastName position role profilePicture departmentId')
    .populate('departmentId', 'name')
    .lean();
  const ids = people.map((p) => p._id);
  const { today: dayStart, tomorrow } = todayBoundaries(now);

  const [sessions, leaves, missions] = await Promise.all([
    Attendance.find({ userId: { $in: ids }, date: { $gte: dayStart, $lt: tomorrow } }).select('userId checkIn checkOut status breaks lateBy').lean(),
    LeaveRequest.find({ employeeId: { $in: ids }, status: { $in: FINAL_APPROVED }, startDate: { $lte: dayStart }, endDate: { $gte: dayStart } }).select('employeeId').lean(),
    CalendarEvent.find({ eventType: 'mission', status: 'approved', startDateTime: { $lte: now }, endDateTime: { $gte: now } }).select('createdBy usersInvolved').lean(),
  ]);

  const sessionsBy = new Map();
  sessions.forEach((s) => {
    const key = idOf(s.userId);
    sessionsBy.set(key, [...(sessionsBy.get(key) || []), s]);
  });
  const onLeave = new Set(leaves.map((l) => idOf(l.employeeId)));
  const onMission = new Set();
  missions.forEach((m) => {
    onMission.add(idOf(m.createdBy));
    (m.usersInvolved || []).filter((u) => u.status !== 'declined').forEach((u) => onMission.add(idOf(u.userId)));
  });

  const enriched = people.map((p) => {
    const own = sessionsBy.get(idOf(p._id)) || [];
    const worked = own.filter((s) => s.checkIn).sort((a, b) => new Date(a.checkIn) - new Date(b.checkIn));
    const openSession = worked.find((s) => !s.checkOut);
    return {
      id: idOf(p._id),
      firstName: p.firstName,
      lastName: p.lastName,
      position: p.position,
      profilePicture: p.profilePicture,
      department: p.departmentId?.name || 'No department',
      departmentId: p.departmentId ? idOf(p.departmentId) : null,
      status: today.presenceStatus({ sessions: own, onLeave: onLeave.has(idOf(p._id)), onMission: onMission.has(idOf(p._id)) }),
      since: worked[0]?.checkIn || null,
      onBreak: Boolean(openSession?.breaks?.some((b) => b.startTime && !b.endTime)),
      lateToday: worked[0]?.status === 'Late',
      lateBy: worked[0]?.lateBy || 0,
    };
  });

  const groups = new Map();
  enriched.forEach((p) => {
    const key = p.departmentId || 'none';
    if (!groups.has(key)) groups.set(key, { id: key, name: p.department, people: [] });
    groups.get(key).people.push(p);
  });
  const ORDER = { in: 0, late: 1, left: 2, mission: 3, leave: 4, out: 5, absent: 6 };
  const departments = [...groups.values()]
    .map((g) => ({
      ...g,
      people: g.people.sort((a, b) => ORDER[a.status] - ORDER[b.status] || a.lastName.localeCompare(b.lastName)),
      summary: today.summarizePresence(g.people),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return { departments, summary: today.summarizePresence(enriched), asOf: now };
};

// --- Decision queue -----------------------------------------------------------

const leaveItems = async (user, now) => {
  const filter = policies.leaveQueueFilter(user);
  if (!filter) return [];
  const requests = await LeaveRequest.find(filter).populate('employeeId', PERSON_FIELDS).lean();
  if (requests.length === 0) return [];

  // Teammates' leave in the same window, to flag overlaps.
  const from = new Date(Math.min(...requests.map((r) => new Date(r.startDate))));
  const to = new Date(Math.max(...requests.map((r) => new Date(r.endDate))));
  const nearby = await LeaveRequest.find({
    status: { $in: [...FINAL_APPROVED, ...IN_PROGRESS] },
    startDate: { $lte: to },
    endDate: { $gte: from },
  })
    .populate('employeeId', 'firstName lastName departmentId')
    .lean();

  const path = policies.LEAVE_REVIEW_PATH[user.role];
  return requests.map((r) => {
    const dept = r.employeeId?.departmentId ? idOf(r.employeeId.departmentId) : null;
    const team = dept ? nearby.filter((o) => o.employeeId?.departmentId && idOf(o.employeeId.departmentId) === dept) : [];
    return today.leaveQueueItem(r, today.leaveOverlaps(r, team), path, now);
  });
};

const eventItems = async (user, now) => {
  if (!policies.canReviewEvents(user)) return [];
  const events = await CalendarEvent.find({ status: 'pending', endDateTime: { $gte: startOfDay(now) } })
    .populate('createdBy', 'firstName lastName profilePicture')
    .lean();
  if (events.length === 0) return [];
  const resourceIds = events.filter((e) => e.resource).map((e) => e.resource);
  const bookings = resourceIds.length
    ? await CalendarEvent.find({ resource: { $in: resourceIds }, status: { $in: ['pending', 'approved'] }, endDateTime: { $gte: startOfDay(now) } })
        .populate('createdBy', 'firstName lastName')
        .lean()
    : [];
  return events.map((e) => today.eventQueueItem(e, today.eventClashes(e, bookings), now));
};

const buildQueue = async (user, now) => today.sortQueue([...(await leaveItems(user, now)), ...(await eventItems(user, now))]);

// --- Endpoints ------------------------------------------------------------------

// GET /api/today: figures, the decision queue and (for employees) their own open items.
exports.getToday = async (req, res) => {
  try {
    const now = new Date();
    const me = await loadMe(req);
    const [queue, presence] = await Promise.all([buildQueue(req.user, now), computePresence(req.user, me, now)]);

    let mine = null;
    if (req.user.role === 'employee' || req.user.role === 'manager' || req.user.role === 'admin') {
      const [openRequests, upcoming] = await Promise.all([
        LeaveRequest.find({ employeeId: req.user.id, status: { $in: IN_PROGRESS } })
          .sort({ startDate: 1 })
          .select('startDate endDate reason status')
          .lean(),
        CalendarEvent.countDocuments({
          status: 'approved',
          startDateTime: { $gte: now, $lte: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000) },
          $or: [{ createdBy: req.user.id }, { 'usersInvolved.userId': req.user.id }],
        }),
      ]);
      mine = { openRequests, upcomingEvents: upcoming, remainingLeaveDays: me?.remainingLeaveDays ?? null };
    }

    res.json({
      queue,
      presence: presence.summary,
      awaiting: {
        total: queue.length,
        leave: queue.filter((i) => i.kind === 'leave').length,
        events: queue.filter((i) => i.kind === 'event').length,
      },
      mine,
      asOf: now,
    });
  } catch (error) {
    console.error('Error building Today view:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// GET /api/presence: who is in, late, away or not in, by department.
exports.getPresence = async (req, res) => {
  try {
    const me = await loadMe(req);
    res.json(await computePresence(req.user, me));
  } catch (error) {
    console.error('Error computing presence:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// GET /api/me/counts: sidebar badges.
exports.getCounts = async (req, res) => {
  try {
    const now = new Date();
    const userId = req.user.id;
    const leaveFilter = policies.leaveQueueFilter(req.user);
    const [leave, events, invitations, notifications, chat] = await Promise.all([
      leaveFilter ? LeaveRequest.countDocuments(leaveFilter) : 0,
      policies.canReviewEvents(req.user) ? CalendarEvent.countDocuments({ status: 'pending', endDateTime: { $gte: startOfDay(now) } }) : 0,
      CalendarEvent.countDocuments({ startDateTime: { $gte: now }, usersInvolved: { $elemMatch: { userId, status: 'pending' } } }),
      Notification.countDocuments({ recipient: userId, isRead: false }),
      Chat.countDocuments({ receiver: userId, isRead: false, deletedForReceiver: { $ne: true } }),
    ]);
    res.json({ today: leave + events, leave, calendar: events + invitations, notifications, chat });
  } catch (error) {
    console.error('Error counting badges:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// GET /api/search?q=: people by name, position or email (public directory fields).
exports.search = async (req, res) => {
  try {
    const words = String(req.query.q || '').trim().split(/\s+/).filter(Boolean).slice(0, 4);
    if (words.join('').length < 2) return res.json({ people: [] });
    const people = await User.find({
      $and: words.map((w) => {
        const rx = new RegExp(escapeRegex(w), 'i');
        return { $or: [{ firstName: rx }, { lastName: rx }, { position: rx }, { email: rx }] };
      }),
    })
      .select('firstName lastName position role email profilePicture departmentId')
      .populate('departmentId', 'name')
      .limit(8)
      .lean();
    res.json({
      people: people.map((p) => ({
        id: idOf(p._id),
        firstName: p.firstName,
        lastName: p.lastName,
        position: p.position,
        role: p.role,
        email: p.email,
        profilePicture: p.profilePicture,
        department: p.departmentId?.name || null,
      })),
    });
  } catch (error) {
    console.error('Error searching people:', error);
    res.status(500).json({ message: 'Server error' });
  }
};
