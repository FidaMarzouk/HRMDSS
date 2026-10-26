// Today's presence for a set of people: punched in (on time or late), left,
// on leave, on a mission, absent or not in. Shared by Today and the chat list.
const Attendance = require('../Models/Attendance');
const LeaveRequest = require('../Models/LeaveRequest');
const CalendarEvent = require('../Models/CalendarEvent');
const { FINAL_APPROVED } = require('../constants/leave');
const { todayBoundaries } = require('../utils/time');
const { idOf } = require('./policies');
const { presenceStatus } = require('./today');

/** Map(id -> { status, since, onBreak, lateToday, lateBy }) */
const loadPresence = async (ids, now = new Date()) => {
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
  return new Map(
    ids.map((raw) => {
      const id = idOf(raw);
      const own = sessionsBy.get(id) || [];
      const worked = own.filter((s) => s.checkIn).sort((a, b) => new Date(a.checkIn) - new Date(b.checkIn));
      const openSession = worked.find((s) => !s.checkOut);
      return [
        id,
        {
          status: presenceStatus({ sessions: own, onLeave: onLeave.has(id), onMission: onMission.has(id) }),
          since: worked[0]?.checkIn || null,
          onBreak: Boolean(openSession?.breaks?.some((b) => b.startTime && !b.endTime)),
          lateToday: worked[0]?.status === 'Late',
          lateBy: worked[0]?.lateBy || 0,
        },
      ];
    })
  );
};

// Outside someone's presence scope only a coarse state is shared: in, away
// (leave or mission, without saying which) or out; no times, no lateness.
const COARSE = { in: 'in', late: 'in', left: 'out', leave: 'away', mission: 'away', absent: 'out', out: 'out' };
const coarse = (p) => ({ status: COARSE[p.status] || 'out' });

module.exports = { loadPresence, coarse };
