// Attendance rules used for exceptions and corrections. The working day itself
// (08:00-18:00, lunch 12:30-14:00, late after 08:30) lives in utils/time.js.
// Keep knowledge/enova-robotics-handbook.md in sync if these change.

// A break longer than this is flagged as an exception.
const LONG_BREAK_MINUTES = 90;

// Late on at least COUNT of the last WITHIN_WORKDAYS working days.
const REPEATED_LATENESS = { count: 3, withinWorkdays: 10 };

// A session still open at this time of day counts as a missing punch-out.
const MISSING_PUNCH_OUT_AFTER = { hour: 20, minute: 0 };

// Expected work per day: 08:00-18:00 minus the 12:30-14:00 lunch = 8 h 30.
const EXPECTED_WORK_MINUTES = 8 * 60 + 30;

// How far back an employee may ask for a correction.
const CORRECTION_MAX_AGE_DAYS = 31;

const PUNCH_SOURCES = ['web', 'mobile', 'correction'];

module.exports = {
  LONG_BREAK_MINUTES,
  REPEATED_LATENESS,
  MISSING_PUNCH_OUT_AFTER,
  EXPECTED_WORK_MINUTES,
  CORRECTION_MAX_AGE_DAYS,
  PUNCH_SOURCES,
};
