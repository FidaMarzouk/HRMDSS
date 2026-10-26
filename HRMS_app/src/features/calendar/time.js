import { COMPANY_TZ, toDayKey } from "../../lib/dates";

// Calendar dates are company days ("YYYY-MM-DD"). Arithmetic runs in UTC on
// those keys, and times are read in company time, so the viewer's own time
// zone never moves an event.
const parse = (key) => {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
};
const keyOf = (date) => date.toISOString().slice(0, 10);

export const todayKey = () => toDayKey(new Date());

export const addDays = (key, n) => {
  const d = parse(key);
  d.setUTCDate(d.getUTCDate() + n);
  return keyOf(d);
};

export const addMonths = (key, n) => {
  const d = parse(key);
  return keyOf(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + n, 1)));
};

// 0 = Monday … 6 = Sunday
export const weekdayOf = (key) => (parse(key).getUTCDay() + 6) % 7;
export const isWeekendKey = (key) => weekdayOf(key) >= 5;
export const mondayOf = (key) => addDays(key, -weekdayOf(key));
export const monthStart = (key) => `${key.slice(0, 7)}-01`;
export const monthEnd = (key) => {
  const d = parse(monthStart(key));
  return keyOf(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)));
};
export const range = (from, count) => Array.from({ length: count }, (_, i) => addDays(from, i));

// Weeks (Monday first) covering the month of `key`.
export const monthGrid = (key) => {
  const first = mondayOf(monthStart(key));
  const last = addDays(mondayOf(monthEnd(key)), 6);
  const days = Math.round((parse(last) - parse(first)) / 86400000) + 1;
  return range(first, days);
};

const clockFmt = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: COMPANY_TZ });
export const clock = (value) => (value ? clockFmt.format(new Date(value)) : "");

// Minutes since company midnight.
export const minutesOf = (value) => {
  const [h, m] = clock(value).split(":").map(Number);
  return h * 60 + m;
};

export const formatKey = (key, options = { weekday: "short", day: "numeric", month: "short" }) =>
  parse(key).toLocaleDateString("en-GB", { ...options, timeZone: "UTC" });

// Company days an event touches (an event ending at 00:00 does not touch that day).
export const daysOfEvent = (event) => {
  const first = toDayKey(event.startDateTime);
  const last = toDayKey(new Date(new Date(event.endDateTime).getTime() - 1));
  const out = [];
  for (let k = first; k <= last && out.length < 62; k = addDays(k, 1)) out.push(k);
  return out;
};

// Start and end minutes of an event on one day, clipped to that day.
export const spanOn = (event, key) => {
  const startKey = toDayKey(event.startDateTime);
  const endKey = toDayKey(new Date(new Date(event.endDateTime).getTime() - 1));
  const from = startKey === key ? minutesOf(event.startDateTime) : 0;
  const to = endKey === key ? minutesOf(event.endDateTime) || 24 * 60 : 24 * 60;
  return { from, to: Math.max(to, from + 1) };
};
