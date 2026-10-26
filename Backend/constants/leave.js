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

// --- Decision support (Phase 3). These are checks shown to reviewers, not hard
// blocks: a reviewer can still approve a request that fails one. Keep the
// handbook (knowledge/enova-robotics-handbook.md) in sync if they change.

// Minimum notice, in calendar days between submission and the first day off.
const NOTICE_DAYS = 14;
// Leave that cannot be planned ahead is exempt from the notice check.
const NOTICE_EXEMPT_TYPES = ['Sick Leave', 'Emergency Leave'];

// Most people from one department who may be away on the same working day,
// when the department has no explicit `coverageLimit`: 25% of the team (rounded),
// at least 1. Only days inside a request count against it.
const DEFAULT_COVERAGE_RATIO = 0.25;

// How long a reviewer can undo an approval or rejection. Notifications wait
// until it ends. The UI shows 8 s; the extra 2 s absorb network latency.
const UNDO_WINDOW_MS = 10_000;

module.exports = {
  NOTICE_DAYS,
  NOTICE_EXEMPT_TYPES,
  DEFAULT_COVERAGE_RATIO,
  UNDO_WINDOW_MS,
  LEAVE_TYPES,
  LEAVE_STATUSES,
  FINAL_APPROVED,
  IN_PROGRESS,
  REJECTED,
  MONTHLY_ACCRUAL,
};
