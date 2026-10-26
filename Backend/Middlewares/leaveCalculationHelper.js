const User = require("../Models/User");
const LeaveRequest = require("../Models/LeaveRequest");
const { FINAL_APPROVED, MONTHLY_ACCRUAL, ANNUAL_LEAVE_CAP } = require('../constants/leave');
const { countWorkingDays, startOfDay } = require('../utils/time');

/*
 * Leave balances run by calendar year (company time):
 *  - each month of the year earns the role's monthly accrual (employees 1 day,
 *    managers, HR and the CEO 2 days), from January, or from the month after
 *    the hire month in the year someone joins, up to the current month;
 *  - a year never earns more than ANNUAL_LEAVE_CAP days;
 *  - unused days do not carry over: on 1 January everyone starts again at 0;
 *  - a request uses the working days that fall inside each year it touches.
 */

/**
 * Leave is counted in working days (Monday–Friday), inclusive of both ends.
 */
const calculateLeaveDays = (startDate, endDate) => countWorkingDays(startDate, endDate);

const yearStart = (year) => new Date(year, 0, 1);
const yearEnd = (year) => new Date(year, 11, 31);

/**
 * Days earned in the calendar year of `asOf`, up to and including its month.
 */
const calculateAccruedLeaveDays = (hireDate, role = 'employee', asOf = new Date()) => {
  const at = new Date(asOf);
  const hire = new Date(hireDate);
  if (Number.isNaN(hire.getTime()) || hire > at) return 0;
  const year = at.getFullYear();
  // First month that earns days this year: January, or the month after hiring.
  const firstMonth = hire.getFullYear() < year ? 0 : hire.getMonth() + 1;
  const months = Math.max(0, at.getMonth() - firstMonth + 1);
  const monthlyAccrual = MONTHLY_ACCRUAL[role] ?? MONTHLY_ACCRUAL.employee;
  return Math.min(ANNUAL_LEAVE_CAP, months * monthlyAccrual);
};

/**
 * Working days of finally-approved leave that fall inside `year`.
 * `excludeId` leaves one request out (when re-checking that request).
 */
const calculateDaysTaken = async (userId, year = new Date().getFullYear(), excludeId = null) => {
  const from = yearStart(year);
  const to = yearEnd(year);
  const filter = { employeeId: userId, status: { $in: FINAL_APPROVED }, startDate: { $lte: to }, endDate: { $gte: from } };
  if (excludeId) filter._id = { $ne: excludeId };
  const approvedRequests = await LeaveRequest.find(filter).select('startDate endDate').lean();
  return approvedRequests.reduce(
    (total, r) => total + calculateLeaveDays(r.startDate > from ? r.startDate : from, r.endDate < to ? r.endDate : to),
    0
  );
};

/**
 * Balance of one year: earned by `asOf` (capped), taken, remaining.
 */
const yearBalance = async (user, year, asOf, excludeId = null) => {
  const totalAccruedDays = calculateAccruedLeaveDays(user.hireDate, user.role, asOf);
  const daysTaken = await calculateDaysTaken(user._id, year, excludeId);
  return { year, totalAccruedDays, daysTaken, remainingDays: Math.max(0, totalAccruedDays - daysTaken), annualCap: ANNUAL_LEAVE_CAP };
};

/**
 * Recompute and store a user's balance for the current year. Derived from
 * approved requests, so it is idempotent and safe after any change; on
 * 1 January it naturally starts again from 0.
 */
const updateUserLeaveBalance = async (userId, now = new Date()) => {
  const user = await User.findById(userId);
  if (!user) throw new Error('User not found');

  const balance = await yearBalance(user, now.getFullYear(), now);
  user.leaveRequestAllowed = balance.totalAccruedDays;
  user.remainingLeaveDays = balance.remainingDays;
  await user.save();
  return balance;
};

/**
 * Balance that applies to a request starting on `startDate`: this year's
 * balance today, or, for a later year, what will have been earned by then.
 */
const balanceForDate = async (user, startDate, now = new Date(), excludeId = null) => {
  const start = startOfDay(startDate);
  const year = start.getFullYear();
  const asOf = year > now.getFullYear() ? start : year < now.getFullYear() ? yearEnd(year) : now;
  return yearBalance(user, year, asOf, excludeId);
};

class LeaveValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'LeaveValidationError';
    this.status = 400;
  }
}

/**
 * Validate a leave request against the balance of every year it touches.
 * For a later year, only what will have been earned by the end of the
 * request in that year counts (balances restart at 0 on 1 January).
 */
const validateLeaveRequest = async (userId, startDate, endDate, now = new Date()) => {
  const current = await updateUserLeaveBalance(userId, now);
  const user = await User.findById(userId).select('hireDate role').lean();
  const start = startOfDay(startDate);
  const end = startOfDay(endDate);
  const daysRequested = calculateLeaveDays(start, end);

  if (daysRequested === 0) {
    throw new LeaveValidationError('The selected period contains no working days.');
  }

  for (let year = start.getFullYear(); year <= end.getFullYear(); year++) {
    const segFrom = year === start.getFullYear() ? start : yearStart(year);
    const segTo = year === end.getFullYear() ? end : yearEnd(year);
    const days = calculateLeaveDays(segFrom, segTo);
    if (!days) continue;
    const asOf = year > now.getFullYear() ? segTo : year < now.getFullYear() ? yearEnd(year) : now;
    const balance = await yearBalance(user, year, asOf);
    const later = year > now.getFullYear();
    if (balance.remainingDays <= 0) {
      throw new LeaveValidationError(
        later
          ? `Leave balances restart at 0 on 1 January: by then you will not have earned any ${year} leave days yet.`
          : 'You have no remaining leave days available.'
      );
    }
    if (days > balance.remainingDays) {
      throw new LeaveValidationError(
        later
          ? `Insufficient ${year} leave days: balances restart at 0 on 1 January, and by ${segTo.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })} you will have earned ${balance.remainingDays} day${balance.remainingDays === 1 ? '' : 's'} but this request needs ${days} in ${year}.`
          : `Insufficient leave days. You have ${balance.remainingDays} days remaining but requested ${days} days.`
      );
    }
  }

  return { ...current, daysRequested };
};

/**
 * Update all users' leave balances - run monthly by cron (and so on 1 January,
 * which starts the new year at 0).
 */
const updateAllUsersLeaveBalance = async () => {
  try {
    const users = await User.find(User.ACTIVE).select('_id').lean();
    for (const user of users) {
      await updateUserLeaveBalance(user._id);
    }
    console.log(`Monthly leave balance update completed. Updated ${users.length} users.`);
    return { success: true, updatedCount: users.length };
  } catch (error) {
    console.error("Error updating all users leave balance:", error);
    return { success: false, error: error.message };
  }
};

module.exports = {
  calculateLeaveDays,
  calculateAccruedLeaveDays,
  calculateDaysTaken,
  balanceForDate,
  validateLeaveRequest,
  updateUserLeaveBalance,
  updateAllUsersLeaveBalance,
  LeaveValidationError
};
