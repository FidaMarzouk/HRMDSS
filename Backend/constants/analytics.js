// Thresholds for the ranked signals on Analytics. Signals describe teams and
// periods, never risk scores for individuals (see the "Keep it fair" rules).

// How far ahead coverage risk looks, in working days (about 8 weeks).
const TIDE_WORKDAYS = 40;

// Late arrivals "cluster" on a weekday when it holds at least this share of
// the period's late arrivals, and at least MIN_LATE of them.
const LATE_CLUSTER = { share: 0.4, minLate: 3 };

// Late arrivals "rise" when they grow by this factor and by at least MIN_EXTRA.
const LATE_RISE = { factor: 1.5, minExtra: 3 };

// Overtime per person per week above this (hours) is flagged for a department.
const OVERTIME_HOURS_PER_PERSON_WEEK = 3;

// Leave requests waiting longer than this (days) for a decision are flagged.
const WAITING_DAYS = 5;

// Notifications: read rate below this share is flagged (needs MIN_SENT sent).
const LOW_READ_RATE = { rate: 0.3, minSent: 20 };

module.exports = {
  TIDE_WORKDAYS,
  LATE_CLUSTER,
  LATE_RISE,
  OVERTIME_HOURS_PER_PERSON_WEEK,
  WAITING_DAYS,
  LOW_READ_RATE,
};
