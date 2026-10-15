const test = require('node:test');
const assert = require('node:assert/strict');
const { calculateLeaveDays, calculateAccruedLeaveDays } = require('../Middlewares/leaveCalculationHelper');
const { countWorkingDays } = require('../utils/time');

test('leave is counted in working days, inclusive', () => {
  // Mon 6 Oct 2025 – Fri 10 Oct 2025
  assert.equal(calculateLeaveDays('2025-10-06', '2025-10-10'), 5);
  // Fri – Mon spans a weekend: 2 working days
  assert.equal(calculateLeaveDays('2025-10-10', '2025-10-13'), 2);
  // A weekend alone has no working days
  assert.equal(countWorkingDays('2025-10-11', '2025-10-12'), 0);
  // Single day
  assert.equal(countWorkingDays('2025-10-08', '2025-10-08'), 1);
  // End before start
  assert.equal(countWorkingDays('2025-10-10', '2025-10-06'), 0);
});

test('accrual is 1 day/month for employees and 2 for managers and admins', () => {
  const now = new Date('2025-10-15');
  assert.equal(calculateAccruedLeaveDays('2025-01-15', 'employee', now), 9);
  assert.equal(calculateAccruedLeaveDays('2025-01-15', 'manager', now), 18);
  assert.equal(calculateAccruedLeaveDays('2025-01-15', 'admin', now), 18);
  // Unknown role falls back to the employee rate
  assert.equal(calculateAccruedLeaveDays('2025-01-15', undefined, now), 9);
  // Hire date in the future never gives negative leave
  assert.equal(calculateAccruedLeaveDays('2026-01-15', 'employee', now), 0);
});
