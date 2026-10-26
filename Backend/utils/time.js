// Time helpers. server.js sets process.env.TZ = 'Africa/Tunis', so local-time
// Date methods already operate in company time; no manual UTC offsets needed.

// Company time zone, for Mongo date operators ($hour, $dateToString...), which work in UTC by default.
const COMPANY_TZ = 'Africa/Tunis';

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

// "YYYY-MM-DD" of a company day (toISOString would give the UTC day, one day early at midnight).
const dayKey = (date) => {
  const d = startOfDay(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
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

// Date-only fields (hire date, birthdate, leave start/end) are stored as
// midnight in company time. A "YYYY-MM-DD" string is read as that calendar day
// in Tunis (not UTC, which is what `new Date('YYYY-MM-DD')` would do); any other
// date or timestamp is reduced to the start of its company-time day.
// null/undefined/'' pass through so optional fields stay empty.
const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;
const toCompanyDate = (value) => {
  if (value === null || value === undefined || value === '') return value;
  const match = typeof value === 'string' && DATE_ONLY.exec(value.trim());
  if (match) return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? date : startOfDay(date);
};

module.exports = {
  COMPANY_TZ,
  WORK_START,
  LATE_AFTER,
  WORK_END,
  LUNCH_START,
  LUNCH_END,
  PUNCH_WINDOW,
  atTimeToday,
  startOfDay,
  dayKey,
  endOfDay,
  todayBoundaries,
  isWeekend,
  countWorkingDays,
  minutesBetween,
  toCompanyDate,
};
