// Time tools: today's punch state, prepare a punch (confirmed by the person),
// prepare an attendance correction, and, for the designated reviewer only,
// list and prepare correction decisions.
const Attendance = require('../../../Models/Attendance');
const AttendanceCorrection = require('../../../Models/AttendanceCorrection');
const policies = require('../../policies');
const { CORRECTION_MAX_AGE_DAYS } = require('../../../constants/attendance');
const { todayBoundaries, startOfDay, dayKey, PUNCH_WINDOW, LUNCH_START, LUNCH_END } = require('../../../utils/time');
const drafts = require('../drafts');
const { z, ToolError, DAY, TIME, ID, at, dayOf, fmtDay, fmtTime, fullName } = require('../common');

const DAY_MS = 24 * 60 * 60 * 1000;
const PUNCHERS = ['employee', 'manager', 'admin'];
const KIND = { missing_punch_out: 'Missing punch-out', missing_punch_in: 'Forgotten punch-in', wrong_times: 'Wrong times' };

const todayState = async (userId) => {
  const { today, tomorrow } = todayBoundaries();
  const sessions = await Attendance.find({ userId, date: { $gte: today, $lt: tomorrow } }).sort({ sessionNumber: 1 }).lean();
  const worked = sessions.filter((s) => s.checkIn);
  const open = worked.find((s) => !s.checkOut);
  const onBreak = Boolean(open?.breaks?.some((b) => b.startTime && !b.endTime));
  return {
    state: open ? (onBreak ? 'on_break' : 'punched_in') : worked.length ? 'punched_out' : 'not_punched_in',
    sessions: worked.map((s) => ({ in: fmtTime(s.checkIn), out: s.checkOut ? fmtTime(s.checkOut) : null, status: s.status, hours: s.productionHours || 0 })),
    firstIn: worked[0] ? fmtTime(worked[0].checkIn) : null,
    late: worked[0]?.status === 'Late',
  };
};

const minutesNow = () => {
  const n = new Date();
  return n.getHours() * 60 + n.getMinutes();
};

const PUNCH_LABEL = { in: 'Punch in', out: 'Punch out', break_start: 'Start break', break_end: 'End break' };

module.exports = [
  {
    name: 'get_my_day',
    skill: 'time',
    effect: 'read',
    description: "The current person's punch state today (not punched in, punched in, on break, punched out) and today's sessions.",
    schema: z.object({}),
    handler: async (ctx) => todayState(ctx.user.id),
  },
  {
    name: 'prepare_punch',
    skill: 'time',
    effect: 'prepare',
    roles: PUNCHERS,
    description:
      'Prepare a punch for the current person right now: in, out, break_start or break_end. It happens at the moment they confirm, not when prepared. Refuses actions that do not fit their current state.',
    schema: z.object({ action: z.enum(['in', 'out', 'break_start', 'break_end']) }),
    handler: async (ctx, a) => {
      const s = await todayState(ctx.user.id);
      const allowed = {
        in: ['not_punched_in', 'punched_out'],
        out: ['punched_in', 'on_break'],
        break_start: ['punched_in'],
        break_end: ['on_break'],
      }[a.action];
      if (!allowed.includes(s.state)) throw new ToolError(`Cannot ${PUNCH_LABEL[a.action].toLowerCase()}: the person is currently ${s.state.replace(/_/g, ' ')}.`);
      const m = minutesNow();
      if (a.action === 'in' && (m < PUNCH_WINDOW.startHour * 60 || m >= PUNCH_WINDOW.endHour * 60)) throw new ToolError('Punching in is only possible between 06:00 and 22:00.');
      if (a.action === 'break_start' && (m < LUNCH_START.hour * 60 + LUNCH_START.minute || m > LUNCH_END.hour * 60 + LUNCH_END.minute)) {
        throw new ToolError('The lunch break can only start between 12:30 and 14:00.');
      }
      return drafts.create(ctx, {
        kind: 'punch',
        title: PUNCH_LABEL[a.action],
        details: [
          { label: 'Action', value: PUNCH_LABEL[a.action] },
          { label: 'Time', value: 'When you confirm' },
          { label: 'Today so far', value: s.sessions.length ? s.sessions.map((x) => `${x.in}–${x.out || '…'}`).join(', ') : 'No sessions yet' },
        ],
        checks: [{ tone: 'info', text: 'Recorded at the moment you confirm, from the web.' }],
        payload: { action: a.action },
      });
    },
  },
  {
    name: 'list_my_recent_days',
    skill: 'time',
    effect: 'read',
    description: 'The current person\'s sessions over the last days (to find a day or session to correct), with ids.',
    schema: z.object({ days: z.number().int().min(1).max(31).optional() }),
    handler: async (ctx, a) => {
      const from = new Date(startOfDay(new Date()).getTime() - ((a.days || 10) - 1) * DAY_MS);
      const rows = await Attendance.find({ userId: ctx.user.id, date: { $gte: from } }).sort({ date: -1, sessionNumber: 1 }).lean();
      return {
        sessions: rows.map((s) => ({ id: String(s._id), day: fmtDay(s.date), date: dayKey(s.date), in: s.checkIn ? fmtTime(s.checkIn) : null, out: s.checkOut ? fmtTime(s.checkOut) : null, status: s.status })),
      };
    },
  },
  {
    name: 'prepare_correction',
    skill: 'time',
    effect: 'prepare',
    roles: PUNCHERS,
    description:
      'Prepare an attendance correction request: missing_punch_out (give out time and the session id), missing_punch_in (give in and out times), or wrong_times (session id and the right in and/or out time). Possible for the last 31 days; a reason is required.',
    schema: z.object({
      date: DAY,
      kind: z.enum(['missing_punch_out', 'missing_punch_in', 'wrong_times']),
      sessionId: ID.optional().describe('Required except for missing_punch_in (from list_my_recent_days)'),
      checkIn: TIME.optional(),
      checkOut: TIME.optional(),
      reason: z.string().min(3).max(500),
    }),
    handler: async (ctx, a) => {
      const day = dayOf(a.date);
      if (day > startOfDay(new Date())) throw new ToolError('A future day cannot be corrected.');
      if (startOfDay(new Date()) - day > CORRECTION_MAX_AGE_DAYS * DAY_MS) throw new ToolError(`Corrections are possible for the last ${CORRECTION_MAX_AGE_DAYS} days only.`);
      if (a.kind !== 'missing_punch_in') {
        if (!a.sessionId) throw new ToolError('Give the session id (from list_my_recent_days).');
        const s = await Attendance.findOne({ _id: a.sessionId, userId: ctx.user.id }).lean();
        if (!s) throw new ToolError('That session was not found.');
        if (a.kind === 'missing_punch_out' && s.checkOut) throw new ToolError('That session already has a punch-out.');
      }
      if (a.kind === 'missing_punch_out' && !a.checkOut) throw new ToolError('Give the time they left.');
      if (a.kind === 'missing_punch_in' && (!a.checkIn || !a.checkOut)) throw new ToolError('Give both the arrival and leaving time.');
      if (a.kind === 'wrong_times' && !a.checkIn && !a.checkOut) throw new ToolError('Give the correct time.');
      const checkIn = a.checkIn ? at(a.date, a.checkIn) : null;
      const checkOut = a.checkOut ? at(a.date, a.checkOut) : null;
      if (checkIn && checkOut && checkOut <= checkIn) throw new ToolError('Punch-out must be after punch-in.');
      const pending = await AttendanceCorrection.exists({ userId: ctx.user.id, date: day, status: 'pending', ...(a.sessionId ? { attendanceId: a.sessionId } : { kind: a.kind }) });
      if (pending) throw new ToolError('A correction for this is already waiting for a decision.');
      return drafts.create(ctx, {
        kind: 'correction',
        title: `${KIND[a.kind]} · ${fmtDay(day)}`,
        details: [
          { label: 'Day', value: fmtDay(day) },
          { label: 'What happened', value: KIND[a.kind] },
          ...(a.checkIn ? [{ label: 'Arrived at', value: a.checkIn }] : []),
          ...(a.checkOut ? [{ label: 'Left at', value: a.checkOut }] : []),
          { label: 'Reason', value: a.reason },
        ],
        checks: [{ tone: 'info', text: 'Your reviewer decides; the record changes only if it is approved.' }],
        payload: { date: a.date, kind: a.kind, attendanceId: a.sessionId, checkIn: checkIn?.toISOString(), checkOut: checkOut?.toISOString(), reason: a.reason },
      });
    },
  },
  {
    name: 'list_corrections_waiting_on_me',
    skill: 'time',
    effect: 'read',
    roles: ['manager', 'admin', 'superAdmin'],
    description: 'Attendance corrections waiting for the current person\'s decision as designated reviewer.',
    schema: z.object({}),
    handler: async (ctx) => {
      const filter = policies.correctionQueueFilter(ctx.user);
      if (!filter) return { corrections: [] };
      const rows = await AttendanceCorrection.find(filter).sort({ date: 1 }).limit(15).populate('userId', 'firstName lastName').lean();
      return {
        corrections: rows.map((c) => ({ id: String(c._id), person: fullName(c.userId), day: fmtDay(c.date), kind: KIND[c.kind], in: c.checkIn ? fmtTime(c.checkIn) : null, out: c.checkOut ? fmtTime(c.checkOut) : null, reason: c.reason })),
      };
    },
  },
  {
    name: 'prepare_correction_decision',
    skill: 'time',
    effect: 'prepare',
    roles: ['manager', 'admin', 'superAdmin'],
    description: 'Prepare approving or rejecting an attendance correction. Only available to its designated reviewer; give a reason when rejecting.',
    schema: z.object({ correctionId: ID, approve: z.boolean(), note: z.string().max(500).optional() }),
    handler: async (ctx, a) => {
      const c = await AttendanceCorrection.findById(a.correctionId).populate('userId', 'firstName lastName').lean();
      if (!c) throw new ToolError('Correction not found.');
      if (!policies.canReviewCorrection(ctx.user, { ...c, userId: c.userId?._id })) throw new ToolError('Only the designated reviewer can decide this correction, and it is not waiting on the current person.');
      if (!a.approve && !a.note) throw new ToolError('Give a short reason for rejecting: it is sent to the person.');
      return drafts.create(ctx, {
        kind: 'correction_decision',
        title: `${a.approve ? 'Approve' : 'Reject'} correction · ${fullName(c.userId)} · ${fmtDay(c.date)}`,
        details: [
          { label: 'Person', value: fullName(c.userId) },
          { label: 'Day', value: fmtDay(c.date) },
          { label: 'Asked', value: `${KIND[c.kind]}${c.checkIn ? `, in ${fmtTime(c.checkIn)}` : ''}${c.checkOut ? `, out ${fmtTime(c.checkOut)}` : ''}` },
          { label: 'Reason given', value: c.reason },
          ...(a.note ? [{ label: 'Your note', value: a.note }] : []),
        ],
        checks: [{ tone: 'info', text: a.approve ? 'The attendance record is updated and its hours recalculated.' : 'The person is told why.' }],
        payload: { correctionId: a.correctionId, approve: a.approve, note: a.note },
      });
    },
  },
];
