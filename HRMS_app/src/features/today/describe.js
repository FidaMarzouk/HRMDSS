import { countWorkingDays, formatDay } from "../../lib/dates";

const timeOf = (d) => new Date(d).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });

// "24–27 Nov · 4 days" for leave, "Thu 22 Oct · 09:30–12:00 · Booking" for events.
export const describeWhen = (item) => {
  if (item.kind === "correction") {
    const date = formatDay(item.startDate, { weekday: "short", day: "numeric", month: "short" });
    const times = [item.correction?.checkIn && `in ${item.correction.checkIn}`, item.correction?.checkOut && `out ${item.correction.checkOut}`].filter(Boolean).join(" · ");
    return `${date}${times ? ` · ${times}` : ""} · correction`;
  }
  if (item.kind === "leave") {
    const days = countWorkingDays(item.startDate, item.endDate);
    const start = formatDay(item.startDate, { day: "numeric", month: "short" });
    const end = formatDay(item.endDate, { day: "numeric", month: "short" });
    return `${start === end ? start : `${start} – ${end}`} · ${days} day${days === 1 ? "" : "s"}`;
  }
  const date = new Date(item.startDate).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
  return `${date} · ${timeOf(item.startDate)}–${timeOf(item.endDate)} · ${item.eventType}`;
};
