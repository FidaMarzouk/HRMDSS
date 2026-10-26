// Analytics overview: tickers, ranked signals, arrivals, attendance barcode,
// leave tide and hours budget for a period. HR and the CEO see the company
// (optionally one department); a manager sees their own department.
const mongoose = require('mongoose');
const User = require('../Models/User');
const Department = require('../Models/Department');
const Attendance = require('../Models/Attendance');
const LeaveRequest = require('../Models/LeaveRequest');
const Notification = require('../Models/Notification');
const { FINAL_APPROVED, IN_PROGRESS } = require('../constants/leave');
const { TIDE_WORKDAYS } = require('../constants/analytics');
const { startOfDay, endOfDay, toCompanyDate } = require('../utils/time');
const { coverageLimitFor } = require('../services/leaveRules');
const { idOf } = require('../services/policies');
const analytics = require('../services/analytics');

const DAY = 24 * 60 * 60 * 1000;
const MAX_DAYS = 366;
const NOTIFICATION_LABELS = {
  leave_request: 'leave requests',
  leave_approved: 'leave approvals',
  leave_rejected: 'leave rejections',
  leave_counter_proposal: 'counter-proposals',
  attendance_correction: 'time corrections',
  event: 'event updates',
  event_invitation: 'event invitations',
  event_response: 'event responses',
};

const fullName = (u) => `${u.firstName || ''} ${u.lastName || ''}`.trim();

// "YYYY-MM-DD" params, defaulting to the last 30 days.
const readPeriod = (query, now) => {
  const to = query.to ? toCompanyDate(query.to) : startOfDay(now);
  const from = query.from ? toCompanyDate(query.from) : new Date(to.getTime() - 29 * DAY);
  if (Number.isNaN(from?.getTime()) || Number.isNaN(to?.getTime()) || from > to) return null;
  if ((to - from) / DAY + 1 > MAX_DAYS) return null;
  return analytics.periods(from, to);
};

// Departments and people in the caller's scope.
const loadScope = async (req) => {
  let departmentId = mongoose.isValidObjectId(req.query.department) ? String(req.query.department) : null;
  if (req.user.role === 'manager') {
    const me = await User.findById(req.user.id).select('departmentId').lean();
    departmentId = me?.departmentId ? String(me.departmentId) : null;
    if (!departmentId) return { departments: [], people: [], departmentId: null };
  }
  const departments = await Department.find(departmentId ? { _id: departmentId } : {}).select('name coverageLimit').sort({ name: 1 }).lean();
  const allDepartments = req.user.role === 'manager' ? departments : await Department.find().select('name').sort({ name: 1 }).lean();
  const people = await User.find({ ...User.ACTIVE, role: { $ne: 'superAdmin' }, departmentId: { $in: departments.map((d) => d._id) } })
    .select('firstName lastName departmentId hireDate')
    .lean();
  const deptName = new Map(departments.map((d) => [String(d._id), d.name]));
  return {
    departmentId,
    departments,
    options: allDepartments.map((d) => ({ id: String(d._id), name: d.name })),
    people: people.map((p) => ({ id: String(p._id), name: fullName(p), departmentId: String(p.departmentId), department: deptName.get(String(p.departmentId)), hireDate: p.hireDate })),
  };
};

const getOverview = async (req, res) => {
  try {
    const now = new Date();
    const period = readPeriod(req.query, now);
    if (!period) return res.status(400).json({ message: 'Choose a valid period of at most one year.' });
    const { current, previous } = period;

    const scope = await loadScope(req);
    const ids = scope.people.map((p) => p.id);
    const today = startOfDay(now);
    const tideDays = analytics.nextWorkdays(today, TIDE_WORKDAYS);

    const [sessions, previousSessions, leaves, previousLeaves, tideLeaves, waitingRequests, notifications] = await Promise.all([
      Attendance.find({ userId: { $in: ids }, date: { $gte: current.from, $lte: endOfDay(current.to) } }).select('userId date sessionNumber checkIn checkOut status productionHours overtime').lean(),
      Attendance.find({ userId: { $in: ids }, date: { $gte: previous.from, $lte: endOfDay(previous.to) } }).select('userId date sessionNumber checkIn checkOut status productionHours overtime').lean(),
      LeaveRequest.find({ employeeId: { $in: ids }, status: { $in: FINAL_APPROVED }, startDate: { $lte: current.to }, endDate: { $gte: current.from } }).select('employeeId startDate endDate status').lean(),
      LeaveRequest.find({ employeeId: { $in: ids }, status: { $in: FINAL_APPROVED }, startDate: { $lte: previous.to }, endDate: { $gte: previous.from } }).select('employeeId startDate endDate status').lean(),
      LeaveRequest.find({ employeeId: { $in: ids }, status: { $in: [...FINAL_APPROVED, ...IN_PROGRESS] }, startDate: { $lte: tideDays[tideDays.length - 1] }, endDate: { $gte: today } }).select('employeeId startDate endDate status').lean(),
      LeaveRequest.find({ employeeId: { $in: ids }, status: { $in: IN_PROGRESS }, 'counterProposal.status': { $ne: 'open' } }).select('employeeId createdAt').lean(),
      Notification.find({ recipient: { $in: ids }, createdAt: { $gte: current.from, $lte: endOfDay(current.to) } }).select('type isRead').lean(),
    ]);

    // Days only count once they have started: a period ending in the future stops today.
    const lastDay = current.to < today ? current.to : today;
    const days = current.from <= lastDay ? analytics.workdays(current.from, lastDay) : [];
    const previousDays = analytics.workdays(previous.from, previous.to);

    const rows = analytics.barcode({ people: scope.people, days, sessions, leaves });
    const previousRows = analytics.barcode({ people: scope.people, days: previousDays, sessions: previousSessions, leaves: previousLeaves });
    const ticker = analytics.tickerFromBarcode(rows, days);
    const previousTicker = analytics.tickerFromBarcode(previousRows, previousDays);

    const expectedDays = (list) => new Map(list.map((r) => [r.id, r.cells.filter((c) => c && c !== 'leave').length]));
    const hours = analytics.hoursBudget({ people: scope.people, sessions, expectedDays: expectedDays(rows) });
    const overtimeOf = (list) => Math.round(list.reduce((n, s) => n + (s.overtime || 0), 0) / 6) / 10;
    const overtimeDaily = days.map((d) => {
      const key = analytics.dayKey(d);
      return { date: key, hours: overtimeOf(sessions.filter((s) => analytics.dayKey(s.date) === key)) };
    });

    const currentArrivals = analytics.arrivals(sessions);
    const previousArrivals = analytics.arrivals(previousSessions);

    // Coverage per department over the coming working days.
    const nameOf = new Map(scope.people.map((p) => [p.id, p.name.split(' ')[0]]));
    const coverage = scope.departments.map((d) => {
      const members = new Set(scope.people.filter((p) => p.departmentId === String(d._id)).map((p) => p.id));
      const deptLeaves = tideLeaves.filter((l) => members.has(idOf(l.employeeId)));
      const limit = coverageLimitFor(d, members.size);
      const t = analytics.tide({ days: tideDays, leaves: deptLeaves, limit });
      return {
        departmentId: String(d._id),
        department: d.name,
        teamSize: members.size,
        limit,
        tide: t,
        days: t.columns.map((c) => {
          const day = new Date(`${c.date}T00:00:00`);
          const names = deptLeaves.filter((l) => startOfDay(l.startDate) <= day && day <= startOfDay(l.endDate)).map((l) => nameOf.get(idOf(l.employeeId)));
          return { ...c, names: [...new Set(names)] };
        }),
      };
    });
    const companyLimit = coverage.reduce((n, c) => n + c.limit, 0);
    const tide = analytics.tide({ days: tideDays, leaves: tideLeaves, limit: companyLimit });

    const byType = new Map();
    notifications.forEach((n) => {
      const t = byType.get(n.type) || { type: n.type, label: NOTIFICATION_LABELS[n.type] || n.type, sent: 0, read: 0 };
      t.sent++;
      if (n.isRead) t.read++;
      byType.set(n.type, t);
    });

    const signals = analytics.signals({
      coverage: coverage.filter((c) => c.teamSize > 0),
      lateCurrent: currentArrivals.filter((a) => a.late),
      latePrevious: previousArrivals.filter((a) => a.late),
      hours,
      weeks: days.length / 5,
      missingPunchOuts: sessions.filter((s) => s.checkIn && !s.checkOut && startOfDay(s.date) < today).length,
      waiting: waitingRequests.map((r) => ({ name: nameOf.get(idOf(r.employeeId)), days: Math.floor((now - r.createdAt) / DAY) })),
      notifications: { sent: notifications.length, read: notifications.filter((n) => n.isRead).length, byType: [...byType.values()] },
    });

    const totalOvertime = overtimeOf(sessions);
    const previousOvertime = overtimeOf(previousSessions);

    res.json({
      period: {
        from: analytics.dayKey(current.from),
        to: analytics.dayKey(current.to),
        previous: { from: analytics.dayKey(previous.from), to: analytics.dayKey(previous.to) },
        workdays: days.length,
      },
      scope: { department: scope.departmentId, departments: scope.options, headcount: scope.people.length },
      tickers: {
        attendanceRate: { value: ticker.attendanceRate, previous: previousTicker.attendanceRate, daily: ticker.daily.map((d) => ({ date: d.date, value: d.attendanceRate })) },
        punctuality: { value: ticker.punctuality, previous: previousTicker.punctuality, daily: ticker.daily.map((d) => ({ date: d.date, value: d.punctuality })) },
        overtimeHours: { value: totalOvertime, previous: previousOvertime, daily: overtimeDaily.map((d) => ({ date: d.date, value: d.hours })) },
        absences: { value: ticker.absences, previous: previousTicker.absences },
      },
      signals,
      arrivals: analytics.swarm(scope.people, currentArrivals, previousArrivals),
      barcode: { days: days.map(analytics.dayKey), rows },
      tide: { ...tide, departments: coverage.map((c) => ({ id: c.departmentId, name: c.department, limit: c.limit, teamSize: c.teamSize, overLimit: c.tide.overLimit })) },
      hours,
    });
  } catch (error) {
    console.error('Analytics overview failed:', error);
    res.status(500).json({ message: 'Could not load analytics.' });
  }
};

module.exports = { getOverview };
