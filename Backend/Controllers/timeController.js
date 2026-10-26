// Time page: day ribbons with exceptions, the user's recent days, and
// attendance correction requests (create, list, approve, reject).
const mongoose = require('mongoose');
const Attendance = require('../Models/Attendance');
const AttendanceCorrection = require('../Models/AttendanceCorrection');
const User = require('../Models/User');
const LeaveRequest = require('../Models/LeaveRequest');
const CalendarEvent = require('../Models/CalendarEvent');
const { FINAL_APPROVED } = require('../constants/leave');
const { CORRECTION_MAX_AGE_DAYS } = require('../constants/attendance');
const { startOfDay, isWeekend, toCompanyDate } = require('../utils/time');
const rules = require('../services/attendanceRules');
const policies = require('../services/policies');
const audit = require('../services/audit');
const { resolveApprover } = require('../services/approvers');
const { sendNotificationToUser } = require('../Middlewares/notificationService');

const DAY = 24 * 60 * 60 * 1000;
const idOf = policies.idOf;
const fullName = (u) => (u ? `${u.firstName} ${u.lastName}` : '');
const KIND_LABEL = { missing_punch_out: 'Missing punch-out', missing_punch_in: 'Forgotten punch-in', wrong_times: 'Wrong times' };
const clock = (d) => (d ? new Date(d).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : '');
const dayLabel = (d) => new Date(d).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });

const sendError = (res, status, message) => res.status(status).json({ message });

// People whose attendance the user may see: HR and the CEO everyone; a
// manager their team and themselves; everyone else themselves.
const scopeFilter = (user) => {
  if (user.role === 'admin' || user.role === 'superAdmin') return { ...User.ACTIVE };
  if (user.role === 'manager') return { ...User.ACTIVE, $or: [{ managerId: user.id }, { _id: user.id }] };
  return { _id: user.id };
};

const parseDay = (value) => {
  const day = value ? toCompanyDate(String(value)) : startOfDay(new Date());
  return Number.isNaN(day?.getTime?.()) ? null : startOfDay(day);
};

// Working days going back from `day` (inclusive).
const workdaysBack = (day, n) => {
  const out = [];
  for (const d = startOfDay(day); out.length < n; d.setDate(d.getDate() - 1)) if (!isWeekend(d)) out.push(new Date(d));
  return out;
};

const sessionView = (s) => ({
  id: idOf(s._id),
  sessionNumber: s.sessionNumber,
  checkIn: s.checkIn || null,
  checkOut: s.checkOut || null,
  status: s.status,
  lateBy: s.lateBy || 0,
  overtime: s.overtime || 0,
  productionHours: s.productionHours || 0,
  source: s.source || null,
  corrected: Boolean(s.correctionId),
  breaks: (s.breaks || []).map((b) => ({ startTime: b.startTime || null, endTime: b.endTime || null })),
});

// GET /api/attendance/day?date=YYYY-MM-DD: everyone in scope for one day.
exports.getDay = async (req, res) => {
  try {
    const day = parseDay(req.query.date);
    if (!day) return sendError(res, 400, 'Invalid date');
    const next = new Date(day.getTime() + DAY);
    const now = new Date();
    const people = await User.find({ ...scopeFilter(req.user), hireDate: { $lt: next } })
      .select('firstName lastName position profilePicture departmentId role')
      .populate('departmentId', 'name')
      .lean();
    const ids = people.map((p) => p._id);
    const window = workdaysBack(day, 10);

    const [sessions, leave, missions, pending, lateRecords] = await Promise.all([
      Attendance.find({ userId: { $in: ids }, date: { $gte: day, $lt: next } }).sort({ sessionNumber: 1 }).lean(),
      LeaveRequest.find({ employeeId: { $in: ids }, status: { $in: FINAL_APPROVED }, startDate: { $lte: day }, endDate: { $gte: day } }).select('employeeId reason').lean(),
      CalendarEvent.find({ eventType: 'mission', status: 'approved', startDateTime: { $lt: next }, endDateTime: { $gte: day } }).select('createdBy usersInvolved title').lean(),
      AttendanceCorrection.find({ userId: { $in: ids }, date: day, status: 'pending' }).select('userId kind').lean(),
      Attendance.find({ userId: { $in: ids }, status: 'Late', sessionNumber: 1, date: { $gte: window.at(-1), $lt: next } }).select('userId date').lean(),
    ]);

    const by = (rows, key) => rows.reduce((m, r) => m.set(idOf(r[key]), [...(m.get(idOf(r[key])) || []), r]), new Map());
    const sessionsBy = by(sessions, 'userId');
    const lateBy = by(lateRecords, 'userId');
    const leaveBy = new Map(leave.map((l) => [idOf(l.employeeId), l.reason]));
    const pendingBy = new Map(pending.map((c) => [idOf(c.userId), c.kind]));
    const onMission = new Set();
    missions.forEach((m) => {
      onMission.add(idOf(m.createdBy));
      (m.usersInvolved || []).filter((u) => u.status !== 'declined').forEach((u) => onMission.add(idOf(u.userId)));
    });

    const rows = people.map((p) => {
      const id = idOf(p._id);
      const own = sessionsBy.get(id) || [];
      const anomalies = rules.dayAnomalies({ sessions: own, day, now, onLeave: leaveBy.has(id) });
      // The pattern is shown on a day the person was late, to explain it; it is
      // not a separate exception on days they were on time or away.
      const repeated = anomalies.some((a) => a.kind === 'late') && rules.repeatedLateness((lateBy.get(id) || []).map((r) => r.date), day);
      if (repeated) anomalies.push(repeated);
      return {
        id,
        firstName: p.firstName,
        lastName: p.lastName,
        position: p.position,
        profilePicture: p.profilePicture,
        department: p.departmentId?.name || null,
        sessions: own.filter((s) => s.checkIn).map(sessionView),
        leave: leaveBy.get(id) || null,
        mission: onMission.has(id),
        absent: own.some((s) => s.status === 'Absent'),
        anomalies,
        pendingCorrection: pendingBy.get(id) || null,
      };
    });
    rows.sort((a, b) => (a.department || '~').localeCompare(b.department || '~') || a.lastName.localeCompare(b.lastName));
    res.json({ date: day, people: rows });
  } catch (error) {
    console.error('Error building day view:', error);
    sendError(res, 500, 'Server error');
  }
};

// GET /api/attendance/mine?days=10: the user's own recent working days.
exports.getMine = async (req, res) => {
  try {
    const n = Math.min(31, Math.max(1, Number(req.query.days) || 10));
    const days = workdaysBack(new Date(), n);
    const from = days.at(-1);
    const now = new Date();
    const [sessions, leave, corrections] = await Promise.all([
      Attendance.find({ userId: req.user.id, date: { $gte: from } }).sort({ date: -1, sessionNumber: 1 }).lean(),
      LeaveRequest.find({ employeeId: req.user.id, status: { $in: FINAL_APPROVED }, endDate: { $gte: from } }).select('startDate endDate reason').lean(),
      AttendanceCorrection.find({ userId: req.user.id, date: { $gte: from } }).select('date kind status').lean(),
    ]);
    res.json({
      days: days.map((day) => {
        const own = sessions.filter((s) => startOfDay(s.date).getTime() === day.getTime());
        const onLeave = leave.find((l) => startOfDay(l.startDate) <= day && day <= startOfDay(l.endDate));
        return {
          date: day,
          sessions: own.filter((s) => s.checkIn).map(sessionView),
          leave: onLeave?.reason || null,
          absent: own.some((s) => s.status === 'Absent'),
          anomalies: rules.dayAnomalies({ sessions: own, day, now, onLeave: Boolean(onLeave) }),
          corrections: corrections.filter((c) => startOfDay(c.date).getTime() === day.getTime()).map((c) => ({ id: idOf(c._id), kind: c.kind, status: c.status })),
        };
      }),
    });
  } catch (error) {
    console.error('Error loading own attendance:', error);
    sendError(res, 500, 'Server error');
  }
};

// --- Corrections ----------------------------------------------------------------

const onDay = (date, day) => date && startOfDay(date).getTime() === day.getTime();

// POST /api/attendance/corrections { date, kind, attendanceId?, checkIn?, checkOut?, reason }
exports.createCorrection = async (req, res) => {
  try {
    const { kind, attendanceId, reason } = req.body || {};
    const day = parseDay(req.body?.date);
    const checkIn = req.body?.checkIn ? new Date(req.body.checkIn) : null;
    const checkOut = req.body?.checkOut ? new Date(req.body.checkOut) : null;
    if (!day) return sendError(res, 400, 'A valid date is required');
    if (!KIND_LABEL[kind]) return sendError(res, 400, 'Unknown correction type');
    if (!reason || !String(reason).trim()) return sendError(res, 400, 'Please give a reason');
    if (day > startOfDay(new Date())) return sendError(res, 400, 'You cannot correct a day in the future');
    if (startOfDay(new Date()) - day > CORRECTION_MAX_AGE_DAYS * DAY) return sendError(res, 400, `Corrections are possible for the last ${CORRECTION_MAX_AGE_DAYS} days`);
    if ((checkIn && Number.isNaN(checkIn.getTime())) || (checkOut && Number.isNaN(checkOut.getTime()))) return sendError(res, 400, 'Invalid time');
    if ((checkIn && !onDay(checkIn, day)) || (checkOut && !onDay(checkOut, day))) return sendError(res, 400, 'Times must be on the day being corrected');
    if (checkIn && checkOut && checkOut <= checkIn) return sendError(res, 400, 'Punch-out must be after punch-in');
    if (checkOut && checkOut > new Date()) return sendError(res, 400, 'Punch-out cannot be in the future');

    let session = null;
    if (kind !== 'missing_punch_in') {
      if (!mongoose.isValidObjectId(attendanceId)) return sendError(res, 400, 'Choose the session to correct');
      session = await Attendance.findOne({ _id: attendanceId, userId: req.user.id });
      if (!session || !onDay(session.date, day)) return sendError(res, 404, 'Session not found');
    }
    if (kind === 'missing_punch_out') {
      if (session.checkOut) return sendError(res, 400, 'This session already has a punch-out');
      if (!checkOut) return sendError(res, 400, 'Give the time you left');
      if (checkOut <= session.checkIn) return sendError(res, 400, 'Punch-out must be after punch-in');
    }
    if (kind === 'wrong_times' && !checkIn && !checkOut) return sendError(res, 400, 'Give the correct time');
    if (kind === 'missing_punch_in' && (!checkIn || !checkOut)) return sendError(res, 400, 'Give both the arrival and leaving time');

    const already = await AttendanceCorrection.exists({ userId: req.user.id, date: day, status: 'pending', ...(session ? { attendanceId: session._id } : { kind }) });
    if (already) return sendError(res, 409, 'A correction for this is already waiting for a decision');

    const user = await User.findById(req.user.id).select('firstName lastName role managerId');
    if (!['employee', 'manager', 'admin'].includes(user.role)) return sendError(res, 403, 'Your role does not record attendance');
    const reviewer = await resolveApprover(user);
    if (!reviewer) return sendError(res, 400, 'No approver is assigned to you. Please contact HR.');

    const correction = await AttendanceCorrection.create({
      userId: user._id, requesterRole: user.role, reviewerId: reviewer._id, date: day, kind,
      attendanceId: session?._id, checkIn: checkIn || undefined, checkOut: checkOut || undefined,
      reason: String(reason).trim().slice(0, 500),
    });
    await sendNotificationToUser(reviewer._id, {
      title: 'Attendance correction requested',
      message: `${fullName(user)} asks to fix ${dayLabel(day)}: ${KIND_LABEL[kind].toLowerCase()}${checkIn ? `, in ${clock(checkIn)}` : ''}${checkOut ? `, out ${clock(checkOut)}` : ''}.`,
      type: 'attendance_correction',
      relatedId: correction._id,
    });
    res.status(201).json({ message: 'Correction requested', correction, reviewer: { firstName: reviewer.firstName, lastName: reviewer.lastName } });
  } catch (error) {
    console.error('Error creating correction:', error);
    sendError(res, 500, 'Server error');
  }
};

const correctionView = (c) => ({
  id: idOf(c._id),
  person: c.userId ? { id: idOf(c.userId), firstName: c.userId.firstName, lastName: c.userId.lastName, profilePicture: c.userId.profilePicture } : null,
  date: c.date,
  kind: c.kind,
  label: KIND_LABEL[c.kind],
  checkIn: c.checkIn || null,
  checkOut: c.checkOut || null,
  current: c.attendanceId ? { checkIn: c.attendanceId.checkIn || null, checkOut: c.attendanceId.checkOut || null } : null,
  reason: c.reason,
  status: c.status,
  note: c.note || null,
  decidedBy: c.decidedBy ? fullName(c.decidedBy) : null,
  decidedAt: c.decidedAt || null,
  createdAt: c.createdAt,
});

// GET /api/attendance/corrections?scope=review|mine
exports.listCorrections = async (req, res) => {
  try {
    const filter = req.query.scope === 'review' ? policies.correctionQueueFilter(req.user) : { userId: req.user.id };
    if (!filter) return res.json({ corrections: [] });
    const rows = await AttendanceCorrection.find(filter)
      .sort({ status: 1, date: -1 })
      .limit(50)
      .populate('userId', 'firstName lastName profilePicture')
      .populate('attendanceId', 'checkIn checkOut')
      .populate('decidedBy', 'firstName lastName')
      .lean();
    res.json({ corrections: rows.map(correctionView) });
  } catch (error) {
    console.error('Error listing corrections:', error);
    sendError(res, 500, 'Server error');
  }
};

// Change the attendance record as the correction describes.
const applyCorrection = async (c) => {
  if (c.kind === 'missing_punch_in') {
    await Attendance.deleteMany({ userId: c.userId, date: c.date, status: 'Absent', checkIn: { $exists: false } });
    const others = await Attendance.find({ userId: c.userId, date: c.date, checkIn: { $exists: true } }).sort({ checkIn: 1 }).lean();
    const sessionNumber = others.filter((o) => o.checkIn < c.checkIn).length + 1;
    const derived = rules.recomputeSession({ checkIn: c.checkIn, checkOut: c.checkOut, sessionNumber, previousStatus: others[0]?.status });
    return Attendance.create({ userId: c.userId, date: c.date, sessionNumber, checkIn: c.checkIn, checkOut: c.checkOut, source: 'correction', correctionId: c._id, ...derived });
  }
  const session = await Attendance.findById(c.attendanceId);
  if (!session) throw Object.assign(new Error('The session no longer exists'), { status: 409 });
  if (c.kind === 'missing_punch_out' && session.checkOut) throw Object.assign(new Error('The session was closed in the meantime'), { status: 409 });
  const checkIn = c.checkIn || session.checkIn;
  const checkOut = c.checkOut || session.checkOut;
  if (checkOut && checkOut <= checkIn) throw Object.assign(new Error('Punch-out would be before punch-in'), { status: 409 });
  const first = await Attendance.findOne({ userId: c.userId, date: session.date, sessionNumber: 1 }).select('status').lean();
  const derived = rules.recomputeSession({ checkIn, checkOut, breaks: session.breaks.map((b) => b.toObject()), sessionNumber: session.sessionNumber, previousStatus: first?.status });
  Object.assign(session, { checkIn, checkOut, correctionId: c._id, ...derived });
  return session.save();
};

const decisionHandler = (approve) => async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return sendError(res, 404, 'Correction not found');
    const c = await AttendanceCorrection.findById(req.params.id);
    if (!c) return sendError(res, 404, 'Correction not found');
    if (!policies.canReviewCorrection(req.user, c)) return sendError(res, c.status === 'pending' ? 403 : 409, c.status === 'pending' ? 'You cannot decide this correction' : `Already ${c.status}`);

    if (approve) await applyCorrection(c);
    c.status = approve ? 'approved' : 'rejected';
    c.decidedBy = req.user.id;
    c.decidedAt = new Date();
    c.note = req.body?.note ? String(req.body.note).trim().slice(0, 500) : undefined;
    await c.save();

    const verb = approve ? 'approved' : 'rejected';
    await audit.record({
      actor: req.user, action: `attendance.correction_${approve ? 'approve' : 'reject'}`, entity: 'AttendanceCorrection', entityId: c._id, subject: c.userId,
      summary: `Correction for ${dayLabel(c.date)} (${KIND_LABEL[c.kind].toLowerCase()}) ${verb}`, reason: c.note, req,
    });
    await sendNotificationToUser(c.userId, {
      title: `Attendance correction ${verb}`,
      message: `Your correction for ${dayLabel(c.date)} (${KIND_LABEL[c.kind].toLowerCase()}) was ${verb}.${c.note ? ` Note: "${c.note}"` : ''}`,
      type: 'attendance_correction',
      relatedId: c._id,
    });
    res.json({ message: `Correction ${verb}` });
  } catch (error) {
    if (error.status) return sendError(res, error.status, error.message);
    console.error('Error deciding correction:', error);
    sendError(res, 500, 'Server error');
  }
};

exports.approveCorrection = decisionHandler(true);
exports.rejectCorrection = decisionHandler(false);
