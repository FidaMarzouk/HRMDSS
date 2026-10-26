// People: profile bundle for the directory drawer, skill levels, the audited
// salary reveal, archive / restore, and each person's history.
const mongoose = require('mongoose');
const User = require('../Models/User');
const Department = require('../Models/Department');
const Attendance = require('../Models/Attendance');
const LeaveRequest = require('../Models/LeaveRequest');
const CalendarEvent = require('../Models/CalendarEvent');
const AuditLog = require('../Models/AuditLog');
const { FINAL_APPROVED, IN_PROGRESS } = require('../constants/leave');
const { todayBoundaries, startOfDay } = require('../utils/time');
const { normalizeSkills, MAX_LEVEL } = require('../utils/skills');
const policies = require('../services/policies');
const audit = require('../services/audit');
const accountStatus = require('../services/accountStatus');
const leaveHelper = require('../Middlewares/leaveCalculationHelper');
const { presenceStatus } = require('../services/today');
const { broadcast } = require('../Middlewares/notificationService');

const idOf = policies.idOf;
const fullName = (u) => (u ? `${u.firstName} ${u.lastName}` : '');
const DAY = 24 * 60 * 60 * 1000;

const sendError = (res, status, message) => res.status(status).json({ message });

// Load the target and the viewer's department, and check the viewer may see them.
const loadVisible = async (req, res, select) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    sendError(res, 404, 'Person not found');
    return null;
  }
  const [target, viewer] = await Promise.all([
    User.findById(req.params.id).select(select),
    User.findById(req.user.id).select('departmentId role'),
  ]);
  if (!target) {
    sendError(res, 404, 'Person not found');
    return null;
  }
  if (!policies.canSeePerson(req.user, target, viewer?.departmentId)) {
    sendError(res, 403, 'You are not allowed to view this person');
    return null;
  }
  return { target, viewer };
};

const permissionsFor = (user, target) => {
  const self = idOf(target._id) === String(user.id);
  const admin = user.role === 'admin';
  return {
    canEdit: admin,
    canEditSkills: admin || (user.role === 'manager' && idOf(target.managerId) === String(user.id)),
    canRevealSalary: admin || user.role === 'superAdmin',
    canArchive: admin && !self && target.role !== 'superAdmin' && target.status !== 'archived',
    canRestore: admin && target.status === 'archived',
    canSeeHistory: admin || user.role === 'superAdmin' || self,
    canMessage: !self && target.status !== 'archived',
  };
};

// GET /api/people/:id: everything the profile drawer shows.
exports.getPerson = async (req, res) => {
  try {
    const loaded = await loadVisible(req, res, '-password -passwordResetTokenHash -passwordResetExpires');
    if (!loaded) return;
    const { target } = loaded;
    await target.populate([
      { path: 'departmentId', select: 'name' },
      { path: 'managerId', select: 'firstName lastName position profilePicture' },
      { path: 'skills.validatedBy', select: 'firstName lastName' },
      { path: 'archivedBy', select: 'firstName lastName' },
    ]);
    const permissions = permissionsFor(req.user, target);
    const now = new Date();
    const { today, tomorrow } = todayBoundaries(now);
    const since = startOfDay(new Date(now.getTime() - 30 * DAY));

    const [sessionsToday, onLeaveToday, onMission, attendance, requests, reports] = await Promise.all([
      Attendance.find({ userId: target._id, date: { $gte: today, $lt: tomorrow } }).lean(),
      LeaveRequest.exists({ employeeId: target._id, status: { $in: FINAL_APPROVED }, startDate: { $lte: today }, endDate: { $gte: today } }),
      CalendarEvent.exists({
        eventType: 'mission', status: 'approved', startDateTime: { $lte: now }, endDateTime: { $gte: now },
        $or: [{ createdBy: target._id }, { usersInvolved: { $elemMatch: { userId: target._id, status: { $ne: 'declined' } } } }],
      }),
      Attendance.find({ userId: target._id, date: { $gte: since, $lt: tomorrow } })
        .select('date status checkIn checkOut lateBy productionHours sessionNumber')
        .sort({ date: -1, sessionNumber: 1 })
        .lean(),
      LeaveRequest.find({ employeeId: target._id }).sort({ startDate: -1 }).limit(8).select('startDate endDate reason status counterProposal.status').lean(),
      User.find({ ...User.ACTIVE, managerId: target._id }).select('firstName lastName position profilePicture').sort({ lastName: 1 }).lean(),
    ]);

    // One row per day: first session's status and the day's span.
    const byDay = new Map();
    attendance.forEach((a) => {
      const key = startOfDay(a.date).getTime();
      const day = byDay.get(key) || { date: a.date, status: a.status, checkIn: a.checkIn, checkOut: a.checkOut, lateBy: a.lateBy || 0, hours: 0 };
      if (a.checkOut && (!day.checkOut || a.checkOut > day.checkOut)) day.checkOut = a.checkOut;
      day.hours += a.productionHours || 0;
      byDay.set(key, day);
    });
    const days = [...byDay.values()].sort((a, b) => new Date(b.date) - new Date(a.date));

    // A manager who still leads people must be replaced before archiving.
    if (permissions.canArchive && target.role === 'manager') {
      const led = await Department.find({ managerId: target._id }).select('name').lean();
      if (led.length || reports.length) {
        permissions.canArchive = false;
        permissions.archiveBlocked = `Manages ${led.map((d) => d.name).join(', ') || `${reports.length} people`}; assign a new manager first`;
      }
    }

    const p = target.toObject();
    res.json({
      person: {
        id: idOf(p._id),
        firstName: p.firstName,
        lastName: p.lastName,
        email: p.email,
        phone: p.phone,
        position: p.position,
        role: p.role,
        profilePicture: p.profilePicture,
        hireDate: p.hireDate,
        department: p.departmentId ? { id: idOf(p.departmentId), name: p.departmentId.name } : null,
        manager: p.managerId ? { id: idOf(p.managerId), firstName: p.managerId.firstName, lastName: p.managerId.lastName, position: p.managerId.position } : null,
        skills: (p.skills || []).map((s) => ({
          name: s.name,
          level: s.level || null,
          validatedBy: s.validatedBy ? fullName(s.validatedBy) : null,
          validatedAt: s.validatedAt || null,
        })),
        status: p.status || 'active',
        archivedAt: p.archivedAt || null,
        archivedBy: p.archivedBy ? fullName(p.archivedBy) : null,
        archiveReason: p.archiveReason || null,
        // Private details only for HR; salary only through the audited reveal.
        ...(req.user.role === 'admin' ? { personalEmail: p.personalEmail || null, birthdate: p.birthdate || null } : {}),
      },
      presence: {
        status: presenceStatus({ sessions: sessionsToday, onLeave: Boolean(onLeaveToday), onMission: Boolean(onMission) }),
        since: sessionsToday.filter((s) => s.checkIn).sort((a, b) => a.checkIn - b.checkIn)[0]?.checkIn || null,
      },
      attendance: {
        days,
        summary: {
          present: days.filter((d) => d.status === 'Present').length,
          late: days.filter((d) => d.status === 'Late').length,
          absent: days.filter((d) => d.status === 'Absent').length,
        },
      },
      leave: { remaining: p.remainingLeaveDays ?? null, allowance: p.leaveRequestAllowed ?? null, requests },
      reports: reports.map((r) => ({ id: idOf(r._id), firstName: r.firstName, lastName: r.lastName, position: r.position, profilePicture: r.profilePicture })),
      permissions,
    });
  } catch (error) {
    console.error('Error loading person:', error);
    sendError(res, 500, 'Server error');
  }
};

// GET /api/people/:id/salary: shown on request, and every reveal is logged.
exports.revealSalary = async (req, res) => {
  try {
    const loaded = await loadVisible(req, res, 'firstName lastName salary role managerId status');
    if (!loaded) return;
    const { target } = loaded;
    if (!permissionsFor(req.user, target).canRevealSalary) return sendError(res, 403, 'You are not allowed to see salaries');
    await audit.record({
      actor: req.user,
      action: 'user.salary_reveal',
      entity: 'User',
      entityId: target._id,
      subject: target._id,
      summary: `Salary of ${fullName(target)} viewed`,
      req,
    });
    res.json({ salary: target.salary });
  } catch (error) {
    console.error('Error revealing salary:', error);
    sendError(res, 500, 'Server error');
  }
};

// PUT /api/people/:id/skills { skills: [{ name, level }] }: HR or the person's manager.
exports.updateSkills = async (req, res) => {
  try {
    const loaded = await loadVisible(req, res, 'firstName lastName skills managerId role status');
    if (!loaded) return;
    const { target } = loaded;
    if (!permissionsFor(req.user, target).canEditSkills) return sendError(res, 403, 'Only HR or this person\'s manager can rate skills');
    const incoming = normalizeSkills(req.body?.skills || []);
    if (incoming.some((s) => s.level && (s.level < 1 || s.level > MAX_LEVEL))) return sendError(res, 400, `Levels go from 1 to ${MAX_LEVEL}`);

    const before = normalizeSkills(target.skills);
    const previous = new Map(before.map((s) => [s.name.toLowerCase(), s]));
    const now = new Date();
    // A rating by HR or the manager validates the level.
    target.skills = incoming.map((s) => {
      const old = previous.get(s.name.toLowerCase());
      const changed = !old || old.level !== s.level;
      return changed && s.level
        ? { name: s.name, level: s.level, validatedBy: req.user.id, validatedAt: now }
        : { ...(old || {}), name: s.name, level: s.level || undefined };
    });
    await target.save();
    await audit.record({
      actor: req.user,
      action: 'user.skills',
      entity: 'User',
      entityId: target._id,
      subject: target._id,
      summary: `Skills of ${fullName(target)} updated`,
      changes: [{ field: 'skills', from: before.map((s) => `${s.name}${s.level ? ` ${s.level}` : ''}`).join(', '), to: incoming.map((s) => `${s.name}${s.level ? ` ${s.level}` : ''}`).join(', ') }],
      req,
    });
    res.json({ message: 'Skills updated', skills: target.skills });
  } catch (error) {
    console.error('Error updating skills:', error);
    sendError(res, 500, 'Server error');
  }
};

/**
 * POST /api/people/:id/archive { confirmName, reason }
 * Keeps the person and all their history; ends their access, closes their
 * requests still in progress and removes them from lists and team counts.
 */
exports.archive = async (req, res) => {
  try {
    const loaded = await loadVisible(req, res, 'firstName lastName role status managerId departmentId');
    if (!loaded) return;
    const { target } = loaded;
    if (!permissionsFor(req.user, target).canArchive) return sendError(res, 403, 'You cannot archive this person');
    const expected = fullName(target).trim().toLowerCase();
    if (String(req.body?.confirmName || '').trim().toLowerCase() !== expected) {
      return sendError(res, 400, `Type "${fullName(target)}" to confirm`);
    }

    // A manager with a team must be replaced first, so nobody is left without an approver.
    if (target.role === 'manager') {
      const [departments, reports] = await Promise.all([
        Department.find({ managerId: target._id }).select('name').lean(),
        User.countDocuments({ ...User.ACTIVE, managerId: target._id }),
      ]);
      if (departments.length || reports) {
        const where = departments.map((d) => d.name).join(', ');
        return sendError(res, 409, `${fullName(target)} still manages ${where || `${reports} people`}. Assign a new manager first.`);
      }
    }

    const now = new Date();
    const reason = req.body?.reason ? String(req.body.reason).trim().slice(0, 500) : undefined;
    target.status = 'archived';
    target.archivedAt = now;
    target.archivedBy = req.user.id;
    target.archiveReason = reason;
    await target.save();
    accountStatus.setArchived(target._id, true);
    if (target.departmentId) await Department.updateOne({ _id: target.departmentId }, { $pull: { employees: target._id } });

    // Close requests that were still waiting on someone.
    const open = await LeaveRequest.find({ employeeId: target._id, status: { $in: IN_PROGRESS } });
    for (const request of open) {
      request.status = request.createdBy === 'Admin' ? 'CEO Rejected' : 'Admin Rejected';
      if (request.counterProposal?.status === 'open') request.counterProposal.status = 'withdrawn';
      request.history.push({ action: 'rejected', status: request.status, by: req.user.id, byRole: req.user.role, at: now, note: 'Closed: employee archived' });
      await request.save();
    }

    await audit.record({
      actor: req.user,
      action: 'user.archive',
      entity: 'User',
      entityId: target._id,
      subject: target._id,
      summary: `${fullName(target)} archived${open.length ? `; ${open.length} open leave request${open.length === 1 ? '' : 's'} closed` : ''}`,
      reason,
      req,
    });
    broadcast('queue:changed');
    broadcast('presence:changed');
    res.json({ message: `${fullName(target)} archived`, closedRequests: open.length });
  } catch (error) {
    console.error('Error archiving person:', error);
    sendError(res, 500, 'Server error');
  }
};

// POST /api/people/:id/restore: give access back; history was never removed.
exports.restore = async (req, res) => {
  try {
    const loaded = await loadVisible(req, res, 'firstName lastName role status departmentId');
    if (!loaded) return;
    const { target } = loaded;
    if (!permissionsFor(req.user, target).canRestore) return sendError(res, 403, 'You cannot restore this person');
    target.status = 'active';
    target.archivedAt = undefined;
    target.archivedBy = undefined;
    target.archiveReason = undefined;
    await target.save();
    accountStatus.setArchived(target._id, false);
    if (target.departmentId && target.role === 'employee') {
      await Department.updateOne({ _id: target.departmentId }, { $addToSet: { employees: target._id } });
    }
    await leaveHelper.updateUserLeaveBalance(target._id);
    await audit.record({ actor: req.user, action: 'user.restore', entity: 'User', entityId: target._id, subject: target._id, summary: `${fullName(target)} restored`, req });
    broadcast('presence:changed');
    res.json({ message: `${fullName(target)} restored` });
  } catch (error) {
    console.error('Error restoring person:', error);
    sendError(res, 500, 'Server error');
  }
};

// GET /api/people/:id/history: audit entries about this person.
exports.getHistory = async (req, res) => {
  try {
    const loaded = await loadVisible(req, res, 'role managerId status');
    if (!loaded) return;
    if (!permissionsFor(req.user, loaded.target).canSeeHistory) return sendError(res, 403, 'You are not allowed to see this history');
    const entries = await AuditLog.find({ subject: loaded.target._id })
      .sort({ at: -1 })
      .limit(100)
      .populate('actor', 'firstName lastName')
      .lean();
    res.json({
      entries: entries.map((e) => ({
        id: idOf(e._id),
        action: e.action,
        summary: e.summary,
        changes: e.changes || [],
        reason: e.reason || null,
        actor: e.actor ? fullName(e.actor) : 'System',
        at: e.at,
      })),
    });
  } catch (error) {
    console.error('Error loading history:', error);
    sendError(res, 500, 'Server error');
  }
};
