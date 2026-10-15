const Attendance = require('../Models/Attendance.js');
const User = require('../Models/User.js');
const LeaveRequest = require('../Models/LeaveRequest');
const { FINAL_APPROVED } = require('../constants/leave');
const {
  WORK_START, LATE_AFTER, WORK_END, LUNCH_START, LUNCH_END, PUNCH_WINDOW,
  atTimeToday, todayBoundaries, minutesBetween
} = require('../utils/time');

// Productive hours = session length minus completed breaks.
const calculateProductionHours = (record) => {
  if (!record.checkIn || !record.checkOut) return 0;

  const totalMinutes = Math.max(0, (record.checkOut - record.checkIn) / (1000 * 60));
  const breakMinutes = record.breaks.reduce(
    (total, b) => total + (b.startTime && b.endTime ? (b.duration || 0) : 0),
    0
  );
  return Number((Math.max(0, totalMinutes - breakMinutes) / 60).toFixed(2));
};

const findOpenSession = (userId) => {
  const { today, tomorrow } = todayBoundaries();
  return Attendance.findOne({
    userId,
    date: { $gte: today, $lt: tomorrow },
    checkIn: { $exists: true },
    checkOut: { $exists: false }
  });
};

const parseRange = (startDate, endDate) => {
  if (!startDate || !endDate) return null;
  const start = new Date(startDate);
  const end = new Date(endDate);
  if (isNaN(start) || isNaN(end)) return null;
  start.setHours(0, 0, 0, 0);
  end.setHours(23, 59, 59, 999);
  return { $gte: start, $lte: end };
};

exports.punchIn = async (req, res) => {
  try {
    const userId = req.user.id;
    const now = new Date();

    if (now.getHours() < PUNCH_WINDOW.startHour || now.getHours() >= PUNCH_WINDOW.endHour) {
      return res.status(400).json({
        message: `Punch-in is only allowed between ${PUNCH_WINDOW.startHour}:00 and ${PUNCH_WINDOW.endHour}:00`,
        status: 'invalid_time'
      });
    }

    if (await findOpenSession(userId)) {
      return res.status(409).json({ message: 'You are already punched in. Punch out first.', status: 'already_punched_in' });
    }

    const { today, tomorrow } = todayBoundaries(now);
    const lastSession = await Attendance.findOne({ userId, date: { $gte: today, $lt: tomorrow } })
      .sort({ sessionNumber: -1 });
    const sessionNumber = lastSession ? lastSession.sessionNumber + 1 : 1;

    const attendance = new Attendance({ userId, checkIn: now, date: today, sessionNumber, productionHours: 0 });

    const scheduledStart = atTimeToday(WORK_START, now);
    const lateThreshold = atTimeToday(LATE_AFTER, now);

    if (now < scheduledStart) {
      const earlyBy = minutesBetween(now, scheduledStart);
      attendance.earlyBy = earlyBy;
      attendance.overtime = earlyBy;
    }

    // Lateness only applies to the day's first session (returning from lunch is not "late").
    if (sessionNumber === 1 && now > lateThreshold) {
      attendance.lateBy = minutesBetween(lateThreshold, now);
      attendance.status = 'Late';
    } else {
      attendance.status = sessionNumber === 1 ? 'Present' : (lastSession.status || 'Present');
    }

    await attendance.save();
    res.status(201).json(attendance);
  } catch (error) {
    console.error('Error in punchIn:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.punchOut = async (req, res) => {
  try {
    const attendance = await findOpenSession(req.user.id);
    if (!attendance) {
      return res.status(404).json({ message: 'No open session found. Punch in first.', status: 'no_open_session' });
    }

    const now = new Date();
    // Close any break left open.
    const openBreak = attendance.breaks.find((b) => !b.endTime);
    if (openBreak) {
      openBreak.endTime = now;
      openBreak.duration = minutesBetween(new Date(openBreak.startTime), now);
    }

    attendance.checkOut = now;

    const scheduledEnd = atTimeToday(WORK_END, now);
    if (now > scheduledEnd) {
      attendance.overtime = (attendance.overtime || 0) + minutesBetween(scheduledEnd, now);
    }

    attendance.productionHours = calculateProductionHours(attendance);
    await attendance.save();
    res.json(attendance);
  } catch (error) {
    console.error('Error in punchOut:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.startBreak = async (req, res) => {
  try {
    const now = new Date();
    const lunchStart = atTimeToday(LUNCH_START, now);
    const lunchEnd = atTimeToday(LUNCH_END, now);

    if (now < lunchStart || now > lunchEnd) {
      return res.status(400).json({
        message: 'Lunch break can only be started between 12:30 and 14:00',
        allowedTimeStart: lunchStart,
        allowedTimeEnd: lunchEnd
      });
    }

    const attendance = await findOpenSession(req.user.id);
    if (!attendance) {
      return res.status(404).json({ message: 'No open session found. Punch in first.', status: 'no_open_session' });
    }
    if (attendance.breaks.some((b) => !b.endTime)) {
      return res.status(409).json({ message: 'A break is already in progress.', status: 'break_in_progress' });
    }

    attendance.breaks.push({ startTime: now });
    await attendance.save();

    res.json({ attendance });
  } catch (error) {
    console.error('Error in startBreak:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.endBreak = async (req, res) => {
  try {
    const attendance = await findOpenSession(req.user.id);
    if (!attendance) {
      return res.status(404).json({ message: 'No open session found.', status: 'no_open_session' });
    }

    const activeBreak = attendance.breaks.find((b) => !b.endTime);
    if (!activeBreak) {
      return res.status(400).json({ message: 'No active break found.', status: 'no_active_break' });
    }

    const now = new Date();
    activeBreak.endTime = now;
    activeBreak.duration = minutesBetween(new Date(activeBreak.startTime), now);
    await attendance.save();

    const totalBreakDuration = attendance.breaks.reduce((sum, b) => sum + (b.duration || 0), 0);

    res.json({ attendance, breakDuration: activeBreak.duration, totalBreakDuration });
  } catch (error) {
    console.error('Error in endBreak:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Current user's recent sessions
exports.getAttendanceHistory = async (req, res) => {
  try {
    const attendance = await Attendance.find({ userId: req.user.id })
      .sort({ date: -1, sessionNumber: -1 })
      .limit(10);
    res.json(attendance);
  } catch (error) {
    console.error('Error in getAttendanceHistory:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Current user's sessions for today
exports.getTodaySessions = async (req, res) => {
  try {
    const { today, tomorrow } = todayBoundaries();
    const sessions = await Attendance.find({
      userId: req.user.id,
      date: { $gte: today, $lt: tomorrow }
    }).sort({ sessionNumber: 1 });
    res.json(sessions);
  } catch (error) {
    console.error('Error in getTodaySessions:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Current user's attendance within a date range
exports.getUserAttendanceByDateRange = async (req, res) => {
  try {
    const range = parseRange(req.query.startDate, req.query.endDate);
    if (!range) {
      return res.status(400).json({ message: 'Valid startDate and endDate are required' });
    }

    const attendance = await Attendance.find({ userId: req.user.id, date: range })
      .populate('userId', 'firstName lastName position')
      .sort({ date: 1 });
    res.status(200).json(attendance);
  } catch (error) {
    console.error('Error in getUserAttendanceByDateRange:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Attendance for the current manager and their team
exports.getManagedEmployeesAttendance = async (req, res) => {
  try {
    const managerId = req.user.id;
    const employees = await User.find({ managerId }).select('_id').lean();
    const userIds = [...employees.map((e) => e._id), managerId];

    const query = { userId: { $in: userIds } };
    const range = parseRange(req.query.startDate, req.query.endDate);
    if (range) query.date = range;

    const attendance = await Attendance.find(query)
      .populate('userId', 'firstName lastName position')
      .sort({ date: -1 });
    res.status(200).json(attendance);
  } catch (error) {
    console.error('Error in getManagedEmployeesAttendance:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Attendance for everyone (admin / CEO)
exports.getAllEmployeesAttendance = async (req, res) => {
  try {
    const query = {};
    const range = parseRange(req.query.startDate, req.query.endDate);
    if (range) query.date = range;

    const attendance = await Attendance.find(query)
      .populate('userId', 'firstName lastName position')
      .sort({ date: -1 });
    res.status(200).json(attendance);
  } catch (error) {
    console.error('Error in getAllEmployeesAttendance:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Cron (22:00 on weekdays): record an absence for anyone with no session today who isn't on approved leave.
exports.markAbsentUsers = async () => {
  const { today, tomorrow } = todayBoundaries();

  const [allUsers, usersOnLeave, usersWithAttendanceToday] = await Promise.all([
    User.find({ hireDate: { $lte: tomorrow } }).select('_id').lean(),
    LeaveRequest.find({
      startDate: { $lt: tomorrow },
      endDate: { $gte: today },
      status: { $in: FINAL_APPROVED }
    }).distinct('employeeId'),
    Attendance.find({ date: { $gte: today, $lt: tomorrow } }).distinct('userId')
  ]);

  const excluded = new Set([...usersOnLeave, ...usersWithAttendanceToday].map(String));
  const absentRecords = allUsers
    .filter((u) => !excluded.has(String(u._id)))
    .map((u) => ({ userId: u._id, date: today, sessionNumber: 1, status: 'Absent', productionHours: 0 }));

  if (absentRecords.length === 0) return 0;
  const result = await Attendance.insertMany(absentRecords);
  return result.length;
};
