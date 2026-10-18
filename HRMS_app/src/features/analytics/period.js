import { formatDay, toDayKey } from "../../lib/dates";

// Periods are pairs of company days ("YYYY-MM-DD"); arithmetic runs in UTC on
// those keys so the viewer's own time zone never shifts a day.
const parse = (key) => {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
};
const key = (date) => date.toISOString().slice(0, 10);

export const addDays = (k, n) => {
  const d = parse(k);
  d.setUTCDate(d.getUTCDate() + n);
  return key(d);
};

const monthStart = (y, m) => key(new Date(Date.UTC(y, m, 1)));
const monthEnd = (y, m) => key(new Date(Date.UTC(y, m + 1, 0)));

export const PRESETS = [
  { value: "last30", label: "Last 30 days" },
  { value: "thisMonth", label: "This month" },
  { value: "lastMonth", label: "Last month" },
  { value: "thisQuarter", label: "This quarter" },
  { value: "lastQuarter", label: "Last quarter" },
];

export function presetRange(preset, today = toDayKey(new Date())) {
  const t = parse(today);
  const y = t.getUTCFullYear();
  const m = t.getUTCMonth();
  const q = Math.floor(m / 3) * 3;
  switch (preset) {
    case "thisMonth":
      return { from: monthStart(y, m), to: today };
    case "lastMonth":
      return { from: monthStart(y, m - 1), to: monthEnd(y, m - 1) };
    case "thisQuarter":
      return { from: monthStart(y, q), to: today };
    case "lastQuarter":
      return { from: monthStart(y, q - 3), to: monthEnd(y, q - 1) };
    case "last30":
    default:
      return { from: addDays(today, -29), to: today };
  }
}

export const daysIn = ({ from, to }) => Math.round((parse(to) - parse(from)) / 86400000) + 1;

// Same length, ending the day before (mirrors Backend/services/analytics.periods).
export const previousOf = (range) => {
  const to = addDays(range.from, -1);
  return { from: addDays(to, -(daysIn(range) - 1)), to };
};

export const describeRange = ({ from, to }) => {
  const sameYear = from.slice(0, 4) === to.slice(0, 4);
  return `${formatDay(from, sameYear ? { day: "numeric", month: "short" } : undefined)} → ${formatDay(to)}`;
};

export const presetOf = (range) => PRESETS.find((p) => {
  const r = presetRange(p.value);
  return r.from === range.from && r.to === range.to;
})?.value;
