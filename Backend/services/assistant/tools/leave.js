// Leave tools: check dates, prepare a request, answer proposed dates, and, for
// the designated reviewer only, list what waits on them and prepare a decision.
const LeaveRequest = require('../../../Models/LeaveRequest');
const Department = require('../../../Models/Department');
const User = require('../../../Models/User');
const { LEAVE_TYPES, FINAL_APPROVED, IN_PROGRESS, REJECTED } = require('../../../constants/leave');
const rules = require('../../leaveRules');
const policies = require('../../policies');
const leaveHelper = require('../../../Middlewares/leaveCalculationHelper');
const { resolveApprover } = require('../../approvers');
const { callController } = require('../invoke');
const leaveController = require('../../../Controllers/leaveRequestController');
const { countWorkingDays, startOfDay, toCompanyDate } = require('../../../utils/time');
const drafts = require('../drafts');
const { z, ToolError, DAY, ID, fmtRange, fullName } = require('../common');

const TYPE = z.enum(LEAVE_TYPES).describe('Leave type');
const REVIEWERS = ['manager', 'admin', 'superAdmin'];

// Everything a reviewer or the requester sees before deciding: working days,
// balance of the year, notice, team coverage, overlaps, suggested dates.
const assess = async (me, { startDate, endDate, reason }, { excludeId } = {}) => {
  const start = toCompanyDate(startDate);
  const end = toCompanyDate(endDate);
  if (end < start) throw new ToolError('The end date must be on or after the start date.');
  const workingDays = countWorkingDays(start, end);
  if (!workingDays) throw new ToolError('Those dates contain no working day (weekends are not counted).');

  const overlap = await LeaveRequest.findOne({
    employeeId: me._id,
    ...(excludeId ? { _id: { $ne: excludeId } } : {}),
    status: { $nin: REJECTED },
    startDate: { $lte: end },
    endDate: { $gte: start },
  }).lean();

  let blocking = null;
  try {
    await leaveHelper.validateLeaveRequest(me._id, start, end);
  } catch (error) {
    if (!(error instanceof leaveHelper.LeaveValidationError)) throw error;
    blocking = error.message;
  }
  const yearly = await leaveHelper.balanceForDate(me, start);

  const department = me.departmentId ? await Department.findById(me.departmentId).select('name coverageLimit').lean() : null;
  const teamMembers = department ? await User.find({ ...User.ACTIVE, departmentId: department._id }).select('firstName lastName').lean() : [me];
  const limit = rules.coverageLimitFor(department, teamMembers.length);
  const teamLeave = await LeaveRequest.find({
    employeeId: { $in: teamMembers.map((m) => m._id) },
    startDate: { $lte: rules.addWorkdays(end, 60) },
    endDate: { $gte: rules.addWorkdays(start, -60) },
  }).select('employeeId startDate endDate status').lean();
  const request = { _id: excludeId || 'draft', employeeId: me._id, startDate: start, endDate: end, reason, status: 'Pending', createdAt: new Date() };
  const coverage = rules.buildCoverage({ request, teamMembers, teamLeave, limit });
  const checks = rules.policyChecks({ request, balance: { remaining: yearly.remainingDays, allowance: yearly.totalAccruedDays, year: yearly.year }, coverage });
  if (overlap) checks.unshift({ tone: 'fail', text: `You already have a request on some of these days (${fmtRange(overlap.startDate, overlap.endDate)}, ${overlap.status}).` });
  if (blocking) checks.unshift({ tone: 'fail', text: blocking });
  const suggestion = coverage.overLimit.length
    ? rules.suggestDates({ request, teamLeave, limit, earliest: rules.addWorkdays(startOfDay(new Date()), 1) })
    : null;
  const awayNames = coverage.rows.filter((r) => r.id !== String(me._id) && r.cells.some((c, i) => c && coverage.inRequest[i])).map((r) => r.fullName);
  return {
    workingDays,
    start,
    end,
    balance: { year: yearly.year, remaining: yearly.remainingDays, earned: yearly.totalAccruedDays },
    checks: checks.map(({ tone, text }) => ({ tone, text })),
    coverage: { limit, teamSize: teamMembers.length, overLimitDays: coverage.overLimit, teammatesAway: awayNames },
    suggestion: suggestion ? { startDate: suggestion.startDate.toISOString().slice(0, 10), endDate: suggestion.endDate.toISOString().slice(0, 10) } : null,
    blocked: Boolean(blocking || overlap),
  };
};

module.exports = [
  {
    name: 'check_leave_dates',
    skill: 'leave',
    effect: 'read',
    description:
      'Check leave dates for the current person before preparing a request: working days, balance of that year, notice period, team coverage (who else is away, days over the limit), overlaps with their own requests, and better dates when coverage is exceeded.',
    schema: z.object({ startDate: DAY, endDate: DAY, type: TYPE }),
    handler: async (ctx, a) => {
      const r = await assess(ctx.me, { startDate: a.startDate, endDate: a.endDate, reason: a.type });
      return { dates: fmtRange(r.start, r.end), workingDays: r.workingDays, balance: r.balance, checks: r.checks, coverage: r.coverage, suggestion: r.suggestion, canRequest: !r.blocked };
    },
  },
  {
    name: 'prepare_leave_request',
    skill: 'leave',
    effect: 'prepare',
    roles: ['employee', 'manager', 'admin'],
    description:
      'Prepare a leave request for the current person to confirm. Runs the same checks as check_leave_dates and refuses if the request would be rejected outright (no balance, overlap, no working day). Nothing is submitted until the person confirms.',
    schema: z.object({ startDate: DAY, endDate: DAY, type: TYPE, note: z.string().max(300).optional().describe('Optional reason to mention in the summary') }),
    handler: async (ctx, a) => {
      const r = await assess(ctx.me, { startDate: a.startDate, endDate: a.endDate, reason: a.type });
      if (r.blocked) throw new ToolError(`Cannot prepare this request: ${r.checks.filter((c) => c.tone === 'fail').map((c) => c.text).join(' ')}`);
      const approver = await resolveApprover(ctx.me);
      if (!approver) throw new ToolError('No approver is assigned to this person: they should contact HR.');
      return drafts.create(ctx, {
        kind: 'leave_request',
        title: `${a.type} · ${fmtRange(r.start, r.end)}`,
        details: [
          { label: 'Dates', value: fmtRange(r.start, r.end) },
          { label: 'Type', value: a.type },
          { label: 'Working days', value: String(r.workingDays) },
          { label: `Balance ${r.balance.year}`, value: `${r.balance.remaining} → ${r.balance.remaining - r.workingDays} days` },
          { label: 'Reviewed by', value: fullName(approver) },
          ...(a.note ? [{ label: 'Note', value: a.note }] : []),
        ],
        checks: r.checks,
        payload: { startDate: a.startDate, endDate: a.endDate, reason: a.type },
      });
    },
  },
  {
    name: 'prepare_proposal_response',
    skill: 'leave',
    effect: 'prepare',
    description: 'When a reviewer proposed other dates for one of the current person\'s leave requests: prepare accepting the new dates or keeping the original ones.',
    schema: z.object({ requestId: ID, accept: z.boolean().describe('true = accept the proposed dates, false = keep the original dates') }),
    handler: async (ctx, a) => {
      const request = await LeaveRequest.findOne({ _id: a.requestId, employeeId: ctx.user.id }).lean();
      if (!request || request.counterProposal?.status !== 'open') throw new ToolError('There is no open date proposal on that request.');
      const p = request.counterProposal;
      return drafts.create(ctx, {
        kind: 'proposal_response',
        title: a.accept ? `Accept ${fmtRange(p.startDate, p.endDate)}` : `Keep ${fmtRange(request.startDate, request.endDate)}`,
        details: [
          { label: 'Original dates', value: fmtRange(request.startDate, request.endDate) },
          { label: 'Proposed dates', value: fmtRange(p.startDate, p.endDate) },
          ...(p.note ? [{ label: 'Reviewer note', value: p.note }] : []),
        ],
        checks: a.accept ? [{ tone: 'info', text: "The reviewer's approval applies to the new dates." }] : [{ tone: 'info', text: 'The original request goes back to the reviewer.' }],
        payload: { requestId: a.requestId, accept: a.accept },
      });
    },
  },
  {
    name: 'list_leave_waiting_on_me',
    skill: 'leave',
    effect: 'read',
    roles: REVIEWERS,
    description: 'Leave requests waiting for the current person\'s decision as designated reviewer (soonest first).',
    schema: z.object({}),
    handler: async (ctx) => {
      const filter = policies.leaveQueueFilter(ctx.user);
      if (!filter) return { requests: [] };
      const rows = await LeaveRequest.find(filter).sort({ startDate: 1 }).limit(15).populate('employeeId', 'firstName lastName').lean();
      return {
        requests: rows.map((r) => ({ id: String(r._id), employee: fullName(r.employeeId), type: r.reason, dates: fmtRange(r.startDate, r.endDate), workingDays: countWorkingDays(r.startDate, r.endDate), status: r.status })),
      };
    },
  },
  {
    name: 'get_leave_request',
    skill: 'leave',
    effect: 'read',
    description: 'Details of one leave request the current person may see (their own, or one they review): status, approval steps, policy checks, team coverage, suggested dates.',
    schema: z.object({ requestId: ID }),
    handler: async (ctx, a) => {
      const { status, body } = await callController(leaveController.getRequestContext, { user: ctx.user, params: { id: a.requestId } });
      if (status >= 400) throw new ToolError(body?.message || 'That request cannot be opened.');
      return {
        id: a.requestId,
        employee: fullName(body.request.employeeId),
        type: body.request.reason,
        dates: fmtRange(body.request.startDate, body.request.endDate),
        workingDays: body.request.workingDays,
        status: body.request.status,
        steps: (body.steps || []).map((s) => `${s.label}: ${s.state}`),
        checks: body.checks,
        coverageOverLimit: body.coverage?.overLimit || [],
        suggestion: body.suggestion ? { startDate: String(body.suggestion.startDate).slice(0, 10), endDate: String(body.suggestion.endDate).slice(0, 10) } : null,
        youAreTheReviewer: Boolean(body.canReview),
      };
    },
  },
  {
    name: 'prepare_leave_decision',
    skill: 'leave',
    effect: 'prepare',
    roles: REVIEWERS,
    description:
      'Prepare approving or rejecting a leave request. Only available when the current person is the designated reviewer of that request right now; refuses otherwise. Give a short note when rejecting.',
    schema: z.object({ requestId: ID, decision: z.enum(['approve', 'reject']), note: z.string().max(500).optional() }),
    handler: async (ctx, a) => {
      const request = await LeaveRequest.findById(a.requestId).populate('employeeId', 'firstName lastName').lean();
      if (!request) throw new ToolError('Leave request not found.');
      const subject = { ...request, employeeId: request.employeeId?._id };
      if (!policies.canReviewLeave(ctx.user, subject) || request.counterProposal?.status === 'open') {
        throw new ToolError('Only the designated reviewer can decide this request, and it is not waiting on the current person.');
      }
      const verb = a.decision === 'approve' ? 'Approve' : 'Reject';
      return drafts.create(ctx, {
        kind: 'leave_decision',
        title: `${verb} ${fullName(request.employeeId)} · ${request.reason} · ${fmtRange(request.startDate, request.endDate)}`,
        details: [
          { label: 'Employee', value: fullName(request.employeeId) },
          { label: 'Dates', value: fmtRange(request.startDate, request.endDate) },
          { label: 'Decision', value: verb },
          ...(a.note ? [{ label: 'Note', value: a.note }] : []),
        ],
        checks: [{ tone: 'info', text: 'After you confirm, you can still undo the decision for a few seconds from the toast.' }],
        payload: { requestId: a.requestId, decision: a.decision, note: a.note },
      });
    },
  },
  {
    name: 'get_team_leave',
    skill: 'leave',
    effect: 'read',
    roles: REVIEWERS,
    description: 'Who is away (approved leave) or has leave in progress between two days, in the current person\'s scope (managers: their department; HR and the CEO: everyone).',
    schema: z.object({ from: DAY, to: DAY }),
    handler: async (ctx, a) => {
      const scope = policies.presenceScope(ctx.user, ctx.me.departmentId);
      const people = await User.find({ ...User.ACTIVE, ...scope }).select('_id firstName lastName').lean();
      const name = new Map(people.map((p) => [String(p._id), fullName(p)]));
      const rows = await LeaveRequest.find({
        employeeId: { $in: people.map((p) => p._id) },
        status: { $in: [...FINAL_APPROVED, ...IN_PROGRESS] },
        startDate: { $lte: toCompanyDate(a.to) },
        endDate: { $gte: toCompanyDate(a.from) },
      })
        .sort({ startDate: 1 })
        .limit(40)
        .lean();
      return {
        leave: rows.map((r) => ({ person: name.get(String(r.employeeId)), type: r.reason, dates: fmtRange(r.startDate, r.endDate), approved: FINAL_APPROVED.includes(r.status) })),
      };
    },
  },
];
