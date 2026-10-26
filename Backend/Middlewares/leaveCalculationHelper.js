const User = require("../Models/User");
const LeaveRequest = require("../Models/LeaveRequest");
const { FINAL_APPROVED, MONTHLY_ACCRUAL } = require('../constants/leave');
const { countWorkingDays } = require('../utils/time');

/**
 * Leave is counted in working days (Monday–Friday), inclusive of both ends.
 */
const calculateLeaveDays = (startDate, endDate) => countWorkingDays(startDate, endDate);

/**
 * Accrued leave days based on full months of service and role.
 * Employees: 1 day per month. Managers / admins / CEO: 2 days per month.
 */
const calculateAccruedLeaveDays = (hireDate, role = 'employee', currentDate = new Date()) => {
  const hire = new Date(hireDate);
  const reference = new Date(currentDate);

  const monthsWorked = (reference.getFullYear() - hire.getFullYear()) * 12 +
    (reference.getMonth() - hire.getMonth());

  const monthlyAccrual = MONTHLY_ACCRUAL[role] ?? MONTHLY_ACCRUAL.employee;
  return Math.max(0, monthsWorked * monthlyAccrual);
};

/**
 * Total leave days consumed by finally-approved requests.
 */
const calculateDaysTaken = async (userId) => {
  const approvedRequests = await LeaveRequest.find({
    employeeId: userId,
    status: { $in: FINAL_APPROVED },
  }).select('startDate endDate').lean();

  return approvedRequests.reduce(
    (total, request) => total + calculateLeaveDays(request.startDate, request.endDate),
    0
  );
};

/**
 * Recompute a user's allowance and remaining balance from scratch.
 * Because it derives everything from approved requests it is idempotent and
 * safe to call after any approval or profile change.
 */
const updateUserLeaveBalance = async (userId) => {
  const user = await User.findById(userId);
  if (!user) throw new Error('User not found');

  const totalAccruedDays = calculateAccruedLeaveDays(user.hireDate, user.role);
  const daysTaken = await calculateDaysTaken(userId);

  user.leaveRequestAllowed = totalAccruedDays;
  user.remainingLeaveDays = Math.max(0, totalAccruedDays - daysTaken);
  await user.save();

  return {
    totalAccruedDays,
    daysTaken,
    remainingDays: user.remainingLeaveDays
  };
};

class LeaveValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'LeaveValidationError';
    this.status = 400;
  }
}

/**
 * Validate a leave request against the user's up-to-date balance.
 */
const validateLeaveRequest = async (userId, startDate, endDate) => {
  const balance = await updateUserLeaveBalance(userId);
  const daysRequested = calculateLeaveDays(startDate, endDate);

  if (daysRequested === 0) {
    throw new LeaveValidationError('The selected period contains no working days.');
  }

  if (balance.remainingDays <= 0) {
    throw new LeaveValidationError('You have no remaining leave days available.');
  }

  if (daysRequested > balance.remainingDays) {
    throw new LeaveValidationError(
      `Insufficient leave days. You have ${balance.remainingDays} days remaining but requested ${daysRequested} days.`
    );
  }

  return { ...balance, daysRequested };
};

/**
 * Update all users' leave balances - run monthly by cron.
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
  validateLeaveRequest,
  updateUserLeaveBalance,
  updateAllUsersLeaveBalance,
  LeaveValidationError
};
