// Date-only fields (hire date, birthdate, leave start/end) are stored by the
// backend as midnight in company time, so they are always read and shown in
// that zone, whatever the viewer's own time zone is.
export const COMPANY_TZ = "Africa/Tunis";

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
const isoDay = new Intl.DateTimeFormat("en-CA", { timeZone: COMPANY_TZ, year: "numeric", month: "2-digit", day: "2-digit" });

// "YYYY-MM-DD" for a stored date, a timestamp or a value already in that form.
export const toDayKey = (value) => {
  if (!value) return "";
  if (typeof value === "string" && DATE_ONLY.test(value)) return value;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : isoDay.format(date);
};

// Value for an <input type="date">.
export const toDateInputValue = toDayKey;

// Display a date-only field, e.g. "21 Mar 2017".
export const formatDay = (value, options = { day: "numeric", month: "short", year: "numeric" }) => {
  const key = toDayKey(value);
  if (!key) return "—";
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-GB", { ...options, timeZone: "UTC" });
};

// Inclusive count of Monday–Friday days between two date-only values, like the backend.
export const countWorkingDays = (start, end) => {
  const from = toDayKey(start);
  const to = toDayKey(end);
  if (!from || !to || to < from) return 0;
  let count = 0;
  for (const d = new Date(`${from}T00:00:00Z`), last = new Date(`${to}T00:00:00Z`); d <= last; d.setUTCDate(d.getUTCDate() + 1)) {
    const day = d.getUTCDay();
    if (day !== 0 && day !== 6) count++;
  }
  return count;
};
