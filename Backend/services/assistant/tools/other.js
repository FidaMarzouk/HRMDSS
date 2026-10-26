// Core (handbook and own data), inbox and insight tools.
const Notification = require('../../../Models/Notification');
const User = require('../../../Models/User');
const knowledgeIndex = require('../../rag/knowledgeIndex');
const { createTools } = require('../../rag/tools');
const policies = require('../../policies');
const { loadPresence } = require('../../presence');
const { callController } = require('../invoke');
const analytics = require('../../../Controllers/analyticsController');
const drafts = require('../drafts');
const { z, ToolError, DAY, ID, fullName } = require('../common');

// The original read-only tools, bound to the signed-in person.
const legacy = (name) => async (ctx, args) => createTools(ctx.user.id).execute(name, args);

const core = [
  {
    name: 'search_handbook',
    skill: 'core',
    effect: 'read',
    description:
      'Search the Enova Robotics handbook and the HRMS user guide (policies, hours, leave rules, approvals, how to use each page). Returns numbered passages; cite them as [n] when you use them.',
    schema: z.object({ query: z.string().min(2).max(300) }),
    handler: async (ctx, a) => {
      const hits = await knowledgeIndex.search(a.query, 4);
      return { passages: hits.map((h, i) => ({ n: i + 1, source: `${h.chunk.file} › ${h.chunk.heading}`, text: h.chunk.text.slice(0, 1500) })) };
    },
  },
  {
    name: 'get_my_profile',
    skill: 'core',
    effect: 'read',
    description: "The current person's work profile: name, role, position, department, manager, hire date, skills, work email.",
    schema: z.object({}),
    handler: legacy('get_my_profile'),
  },
  {
    name: 'get_my_leave_balance',
    skill: 'core',
    effect: 'read',
    description: "The current person's leave balance for this calendar year (earned, taken, remaining, annual cap) and requests awaiting approval.",
    schema: z.object({}),
    handler: legacy('get_my_leave_balance'),
  },
  {
    name: 'get_my_leave_requests',
    skill: 'leave',
    effect: 'read',
    description: "The current person's leave requests (ids, dates, type, working days, status, open date proposals).",
    schema: z.object({ status: z.enum(['all', 'in_progress', 'approved', 'rejected', 'upcoming']).optional() }),
    handler: legacy('get_my_leave_requests'),
  },
  {
    name: 'get_my_attendance',
    skill: 'time',
    effect: 'read',
    description: "Summary of the current person's attendance for today, this week or this month.",
    schema: z.object({ range: z.enum(['today', 'week', 'month']) }),
    handler: legacy('get_my_attendance'),
  },
  {
    name: 'get_my_events',
    skill: 'calendar',
    effect: 'read',
    description: 'Calendar events the current person organises or is invited to (today, this week, this month or the next 30 days).',
    schema: z.object({ range: z.enum(['today', 'week', 'month', 'upcoming']) }),
    handler: legacy('get_my_events'),
  },
];

const inbox = [
  {
    name: 'get_inbox_summary',
    skill: 'inbox',
    effect: 'read',
    description: "What waits in the current person's inbox: notifications that need their action (titles) and unread information.",
    schema: z.object({}),
    handler: async (ctx) => {
      const [action, unread] = await Promise.all([
        Notification.find({ recipient: ctx.user.id, actionable: true, doneAt: null }).sort({ createdAt: -1 }).limit(8).select('title message createdAt priority').lean(),
        Notification.countDocuments({ recipient: ctx.user.id, isRead: false, $or: [{ actionable: { $ne: true } }, { doneAt: { $ne: null } }] }),
      ]);
      return { needsAction: action.map((n) => ({ title: n.title, message: n.message, urgent: n.priority === 'urgent' })), unreadInformation: unread };
    },
  },
  {
    name: 'prepare_message',
    skill: 'inbox',
    effect: 'prepare',
    description: 'Prepare a chat message from the current person to a colleague (id from find_people). It is sent only when they confirm.',
    schema: z.object({ toUserId: ID, text: z.string().min(1).max(2000) }),
    handler: async (ctx, a) => {
      if (a.toUserId === String(ctx.user.id)) throw new ToolError('Pick someone else.');
      const to = await User.findOne({ _id: a.toUserId, ...User.ACTIVE }).select('firstName lastName').lean();
      if (!to) throw new ToolError('That person was not found or has left.');
      return drafts.create(ctx, {
        kind: 'message',
        title: `Message to ${fullName(to)}`,
        details: [
          { label: 'To', value: fullName(to) },
          { label: 'Message', value: a.text },
        ],
        checks: [],
        payload: { receiverId: a.toUserId, message: a.text },
      });
    },
  },
];

const LEADS = ['manager', 'admin', 'superAdmin'];
const insight = [
  {
    name: 'get_who_is_in',
    skill: 'insight',
    effect: 'read',
    roles: LEADS,
    description: "Who is in, late, on leave, on a mission or not in today, in the current person's scope (managers: their department; HR and the CEO: everyone).",
    schema: z.object({}),
    handler: async (ctx) => {
      const people = await User.find({ ...User.ACTIVE, ...policies.presenceScope(ctx.user, ctx.me.departmentId) }).select('firstName lastName').lean();
      const states = await loadPresence(people.map((p) => p._id));
      const groups = {};
      people.forEach((p) => {
        const s = states.get(String(p._id))?.status || 'out';
        (groups[s] = groups[s] || []).push(fullName(p));
      });
      return { total: people.length, byStatus: Object.fromEntries(Object.entries(groups).map(([k, v]) => [k, { count: v.length, people: v.slice(0, 25) }])) };
    },
  },
  {
    name: 'get_analytics_signals',
    skill: 'insight',
    effect: 'read',
    roles: LEADS,
    description: 'The Analytics signals and headline figures (attendance, punctuality, overtime, absences) for a period, in the current person\'s scope. Default period: last 30 days.',
    schema: z.object({ from: DAY.optional(), to: DAY.optional() }),
    handler: async (ctx, a) => {
      const { status, body } = await callController(analytics.getOverview, { user: ctx.user, query: { from: a.from, to: a.to } });
      if (status >= 400) throw new ToolError(body?.message || 'Analytics are not available.');
      const t = body.tickers;
      return {
        period: body.period,
        // Value and previous period only; the daily series stay on the Analytics page.
        figures: Object.fromEntries(['attendanceRate', 'punctuality', 'overtimeHours', 'absences'].map((k) => [k, { value: t[k].value, previous: t[k].previous }])),
        signals: body.signals.map((s) => ({ label: s.label, title: s.title, evidence: s.evidence, action: s.action?.label })),
      };
    },
  },
];

module.exports = [...core, ...inbox, ...insight];
