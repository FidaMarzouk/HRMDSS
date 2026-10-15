// Single source of truth for leave-related values used across models, controllers and the assistant.

const LEAVE_TYPES = [
  'Sick Leave',
  'Vacation Leave',
  'Maternity Leave',
  'Personal Leave',
  'Emergency Leave',
  'Unpaid Leave',
];

const LEAVE_STATUSES = [
  'Pending',
  'Manager Approved',
  'Manager Rejected',
  'Admin Approved',
  'Admin Rejected',
  'CEO Approved',
  'CEO Rejected',
];

// A request only consumes balance (and excuses absence) once it reaches a final approval.
const FINAL_APPROVED = ['Admin Approved', 'CEO Approved'];

// Still moving through the approval chain.
const IN_PROGRESS = ['Pending', 'Manager Approved'];

const REJECTED = ['Manager Rejected', 'Admin Rejected', 'CEO Rejected'];

// Monthly accrual in days, by role.
const MONTHLY_ACCRUAL = {
  employee: 1,
  manager: 2,
  admin: 2,
  superAdmin: 2,
};

module.exports = {
  LEAVE_TYPES,
  LEAVE_STATUSES,
  FINAL_APPROVED,
  IN_PROGRESS,
  REJECTED,
  MONTHLY_ACCRUAL,
};
