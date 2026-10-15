// Read-only tools the assistant can call for the *current user's own* data.
// Every tool is bound to the authenticated user's id in a closure; no tool accepts
// a user identifier as an argument, so the model cannot be steered into reading
// someone else's records.

const User = require('../../Models/User');
require('../../Models/Department'); // registered for populate('departmentId')
const LeaveRequest = require('../../Models/LeaveRequest');
const Attendance = require('../../Models/Attendance');
const CalendarEvent = require('../../Models/CalendarEvent');
const { updateUserLeaveBalance, calculateLeaveDays } = require('../../Middlewares/leaveCalculationHelper');
const { FINAL_APPROVED, IN_PROGRESS, REJECTED } = require('../../constants/leave');
const { startOfDay, endOfDay } = require('../../utils/time');

const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' }) : null);
const fmtTime = (d) => (d ? new Date(d).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : null);

const rangeBounds = (range) => {
  const now = new Date();
  switch (range) {
    case 'today':
      return { start: startOfDay(now), end: endOfDay(now) };
    case 'week': {
      // Monday to Sunday of the current week
      const start = startOfDay(now);
      start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
      const end = endOfDay(new Date(start));
      end.setDate(end.getDate() + 6);
      return { start, end };
    }
    case 'month':
      return { start: new Date(now.getFullYear(), now.getMonth(), 1), end: endOfDay(new Date(now.getFullYear(), now.getMonth() + 1, 0)) };
    case 'upcoming':
    default: {
      const end = new Date(now);
      end.setDate(end.getDate() + 30);
      return { start: now, end };
    }
  }
};

const definitions = [
  {
    type: 'function',
    function: {
      name: 'get_my_leave_balance',
      description: "Get the current user's leave balance: days accrued, days taken and days remaining, plus how many requests are awaiting approval.",
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_my_leave_requests',
      description: "List the current user's leave requests with dates, type, working days and approval status.",
      parameters: {
        type: 'object',
        properties: {
          status: {
            type: 'string',
            enum: ['all', 'in_progress', 'approved', 'rejected', 'upcoming'],
            description: 'Filter: in_progress = pending or manager-approved; approved = final approval; upcoming = approved leave that has not ended yet.',
          },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_my_attendance',
      description: "Summarize the current user's attendance (check-in/out times, late arrivals, absences, breaks, production hours).",
      parameters: {
        type: 'object',
        properties: {
          range: { type: 'string', enum: ['today', 'week', 'month'], description: 'Period to summarize.' },
        },
        required: ['range'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_my_events',
      description: "List calendar events (meetings, missions, resource reservations) the current user organizes or is invited to.",
      parameters: {
        type: 'object',
        properties: {
          range: { type: 'string', enum: ['today', 'week', 'month', 'upcoming'], description: "Period; 'upcoming' = next 30 days." },
        },
        required: ['range'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_my_profile',
      description: "Get the current user's own work profile: name, role, position, department, manager, hire date, skills, work email.",
      parameters: { type: 'object', properties: {} },
    },
  },
];

const createTools = (userId) => {
  const handlers = {
    async get_my_leave_balance() {
      const balance = await updateUserLeaveBalance(userId);
      const awaitingApproval = await LeaveRequest.countDocuments({ employeeId: userId, status: { $in: IN_PROGRESS } });
      return {
        accruedDays: balance.totalAccruedDays,
        daysTaken: balance.daysTaken,
        remainingDays: balance.remainingDays,
        requestsAwaitingApproval: awaitingApproval,
      };
    },

    async get_my_leave_requests({ status = 'all' } = {}) {
      const filter = { employeeId: userId };
      if (status === 'in_progress') filter.status = { $in: IN_PROGRESS };
      if (status === 'approved') filter.status = { $in: FINAL_APPROVED };
      if (status === 'rejected') filter.status = { $in: REJECTED };
      if (status === 'upcoming') {
        filter.status = { $in: FINAL_APPROVED };
        filter.endDate = { $gte: startOfDay(new Date()) };
      }
      const requests = await LeaveRequest.find(filter)
        .sort({ startDate: -1 })
        .limit(10)
        .populate('managerId', 'firstName lastName role')
        .lean();
      return {
        count: requests.length,
        requests: requests.map((r) => ({
          type: r.reason,
          from: fmtDate(r.startDate),
          to: fmtDate(r.endDate),
          workingDays: calculateLeaveDays(r.startDate, r.endDate),
          status: r.status,
          approver: r.managerId ? `${r.managerId.firstName} ${r.managerId.lastName}` : null,
          submitted: fmtDate(r.createdAt),
        })),
      };
    },

    async get_my_attendance({ range = 'today' } = {}) {
      const { start, end } = rangeBounds(range);
      const records = await Attendance.find({ userId, date: { $gte: start, $lte: end } })
        .sort({ date: 1, sessionNumber: 1 })
        .lean();
      const days = new Set(records.map((r) => startOfDay(r.date).getTime()));
      return {
        period: `${fmtDate(start)} – ${fmtDate(end)}`,
        daysWithRecords: days.size,
        lateArrivals: records.filter((r) => r.status === 'Late').length,
        absences: records.filter((r) => r.status === 'Absent').length,
        totalProductionHours: Number(records.reduce((n, r) => n + (r.productionHours || 0), 0).toFixed(2)),
        totalOvertimeMinutes: records.reduce((n, r) => n + (r.overtime || 0), 0),
        sessions: records.slice(-15).map((r) => ({
          date: fmtDate(r.date),
          session: r.sessionNumber,
          status: r.status,
          checkIn: fmtTime(r.checkIn),
          checkOut: fmtTime(r.checkOut) || (r.status === 'Absent' ? null : 'still open'),
          lateByMinutes: r.lateBy || 0,
          breakMinutes: (r.breaks || []).reduce((n, b) => n + (b.duration || 0), 0),
          productionHours: r.productionHours || 0,
        })),
      };
    },

    async get_my_events({ range = 'upcoming' } = {}) {
      const { start, end } = rangeBounds(range);
      const events = await CalendarEvent.find({
        $or: [{ createdBy: userId }, { 'usersInvolved.userId': userId }],
        startDateTime: { $lte: end },
        endDateTime: { $gte: start },
      })
        .sort({ startDateTime: 1 })
        .limit(15)
        .populate('createdBy', 'firstName lastName')
        .populate('resource', 'name type')
        .lean();
      return {
        period: `${fmtDate(start)} – ${fmtDate(end)}`,
        count: events.length,
        events: events.map((e) => {
          const me = (e.usersInvolved || []).find((u) => String(u.userId) === String(userId));
          return {
            title: e.title,
            type: e.eventType,
            date: fmtDate(e.startDateTime),
            start: fmtTime(e.startDateTime),
            end: fmtTime(e.endDateTime),
            location: e.location || null,
            destination: e.destination || null,
            resource: e.resource ? e.resource.name : null,
            approvalStatus: e.status,
            organizer: String(e.createdBy?._id) === String(userId) ? 'you' : (e.createdBy ? `${e.createdBy.firstName} ${e.createdBy.lastName}` : null),
            yourResponse: me ? me.status : null,
          };
        }),
      };
    },

    async get_my_profile() {
      const user = await User.findById(userId)
        .select('firstName lastName email role position hireDate skills departmentId managerId')
        .populate('departmentId', 'name')
        .populate('managerId', 'firstName lastName email')
        .lean();
      if (!user) return { error: 'Profile not found' };
      return {
        name: `${user.firstName} ${user.lastName}`,
        role: user.role,
        position: user.position,
        department: user.departmentId ? user.departmentId.name : null,
        manager: user.managerId ? `${user.managerId.firstName} ${user.managerId.lastName} (${user.managerId.email})` : null,
        hireDate: fmtDate(user.hireDate),
        workEmail: user.email,
        skills: user.skills,
      };
    },
  };

  const execute = async (name, rawArgs) => {
    const handler = handlers[name];
    if (!handler) return { error: `Unknown tool: ${name}` };
    let args = {};
    try {
      args = typeof rawArgs === 'string' && rawArgs.trim() ? JSON.parse(rawArgs) : (rawArgs || {});
    } catch {
      args = {};
    }
    try {
      return await handler(args);
    } catch (err) {
      console.error(`Assistant tool ${name} failed:`, err);
      return { error: 'The data could not be retrieved right now.' };
    }
  };

  return { definitions, execute };
};

module.exports = { createTools, definitions };
