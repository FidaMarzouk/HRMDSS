// Leave balances now run by calendar year (no carry-over, reset on 1 January,
// annual cap): stored balances still hold the old lifetime totals until the
// monthly job runs. This recomputes every active person's stored balance now.
// Balances are derived from approved requests, so running it twice is harmless.
const { updateUserLeaveBalance, calculateAccruedLeaveDays, calculateDaysTaken } = require('../../Middlewares/leaveCalculationHelper');

module.exports = {
  description: 'Recompute leave balances for the calendar year (no carry-over, annual cap)',

  async up({ db, dryRun, log }) {
    const users = await db.collection('users').find({ status: { $ne: 'archived' } }, { projection: { hireDate: 1, role: 1, remainingLeaveDays: 1, firstName: 1, lastName: 1 } }).toArray();
    const year = new Date().getFullYear();
    let changed = 0;
    const examples = [];
    for (const u of users) {
      const accrued = calculateAccruedLeaveDays(u.hireDate, u.role);
      const remaining = Math.max(0, accrued - (await calculateDaysTaken(u._id, year)));
      if (remaining !== u.remainingLeaveDays) {
        changed++;
        if (examples.length < 3) examples.push(`${u.firstName} ${u.lastName}: ${u.remainingLeaveDays ?? '—'} → ${remaining}`);
      }
      if (!dryRun) await updateUserLeaveBalance(u._id);
    }
    log(`users: ${changed} balance(s) ${dryRun ? 'would change' : 'updated'}${examples.length ? ` (e.g. ${examples.join('; ')})` : ''}`);
    return { users: changed };
  },
};
