// Time helpers. server.js sets process.env.TZ = 'Africa/Tunis', so local-time
// Date methods already operate in company time; no manual UTC offsets needed.

const WORK_START = { hour: 8, minute: 0 };
const LATE_AFTER = { hour: 8, minute: 30 };
const WORK_END = { hour: 18, minute: 0 };
const LUNCH_START = { hour: 12, minute: 30 };
const LUNCH_END = { hour: 14, minute: 0 };
const PUNCH_WINDOW = { startHour: 6, endHour: 22 };

const atTimeToday = ({ hour, minute }, base = new Date()) => {
  const d = new Date(base);
  d.setHours(hour, minute, 0, 0);
  return d;
};

const startOfDay = (date = new Date()) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
};

const endOfDay = (date = new Date()) => {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
};

const todayBoundaries = (now = new Date()) => {
  const today = startOfDay(now);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  return { today, tomorrow };
};

const isWeekend = (date) => {
  const day = date.getDay();
  return day === 0 || day === 6;
};

// Inclusive count of Monday–Friday days between two dates.
const countWorkingDays = (startDate, endDate) => {
  const start = startOfDay(startDate);
  const end = startOfDay(endDate);
  if (end < start) return 0;
  let count = 0;
  for (const d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    if (!isWeekend(d)) count++;
  }
  return count;
};

const minutesBetween = (a, b) => Math.floor((b - a) / (1000 * 60));

module.exports = {
  WORK_START,
  LATE_AFTER,
  WORK_END,
  LUNCH_START,
  LUNCH_END,
  PUNCH_WINDOW,
  atTimeToday,
  startOfDay,
  endOfDay,
  todayBoundaries,
  isWeekend,
  countWorkingDays,
  minutesBetween,
};
