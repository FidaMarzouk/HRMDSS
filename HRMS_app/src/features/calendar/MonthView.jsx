import { useMemo } from "react";
import { cn } from "../../lib/utils";
import { Tick } from "./EventChip";
import { stateOf } from "./meta";
import { daysOfEvent, formatKey, minutesOf, monthGrid, todayKey } from "./time";

const MAX_TICKS = 14;

// Hour with the most events starting, e.g. "09:00".
const busiestHour = (events) => {
  const counts = new Map();
  events.forEach((e) => {
    const h = Math.floor(minutesOf(e.startDateTime) / 60);
    counts.set(h, (counts.get(h) || 0) + 1);
  });
  const [hour, n] = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0] || [];
  return n > 1 ? `${String(hour).padStart(2, "0")}:00` : null;
};

/**
 * Month: each day shows a row of ticks (one per event, styled by state) and
 * its busiest hour, instead of "+9 more". Clicking a day opens it as lanes.
 */
export function MonthView({ date, events, onOpenDay }) {
  const days = monthGrid(date);
  const month = date.slice(0, 7);
  const today = todayKey();
  const byDay = useMemo(() => {
    const map = new Map();
    events.forEach((e) => daysOfEvent(e).forEach((k) => map.set(k, [...(map.get(k) || []), e])));
    return map;
  }, [events]);

  return (
    <div>
      <div className="grid grid-cols-7 gap-1 pb-1" aria-hidden="true">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
          <span key={d} className="text-center font-mono text-[10.5px] uppercase tracking-[0.1em] text-ink-3">{d}</span>
        ))}
      </div>
      <ol className="grid grid-cols-7 gap-1">
        {days.map((k, i) => {
          const list = byDay.get(k) || [];
          const inMonth = k.slice(0, 7) === month;
          const busy = busiestHour(list);
          const clashes = list.filter((e) => stateOf(e) === "clash").length;
          const pending = list.filter((e) => stateOf(e) === "pending").length;
          return (
            <li key={k}>
              <button
                type="button"
                onClick={() => onOpenDay(k)}
                aria-label={`${formatKey(k, { weekday: "long", day: "numeric", month: "long" })}: ${list.length ? `${list.length} event${list.length === 1 ? "" : "s"}${pending ? `, ${pending} pending` : ""}${clashes ? `, ${clashes} clash${clashes === 1 ? "" : "es"}` : ""}` : "no events"}`}
                className={cn(
                  "flex h-full min-h-[84px] w-full flex-col gap-1.5 rounded-md border p-1.5 text-left transition-colors hover:border-teal",
                  inMonth ? "border-line bg-panel" : "border-transparent bg-sunk/40 text-ink-3",
                  i % 7 >= 5 && inMonth && "bg-raise",
                  k === today && "border-teal"
                )}
              >
                <span className="flex items-center justify-between">
                  <span className={cn("figure text-[12px]", k === today ? "rounded-full bg-teal px-1.5 font-semibold text-on-accent" : "text-ink-2")}>{Number(k.slice(8))}</span>
                  {list.length > 0 && <span className="figure text-[10.5px] text-ink-3">{list.length}</span>}
                </span>
                {list.length > 0 && (
                  <>
                    <span className="flex flex-wrap gap-[3px]">
                      {list.slice(0, MAX_TICKS).map((e) => (
                        <Tick key={e._id} state={stateOf(e)} />
                      ))}
                      {list.length > MAX_TICKS && <span className="figure text-[10px] text-ink-3">+{list.length - MAX_TICKS}</span>}
                    </span>
                    <span className="mt-auto truncate text-[10.5px] text-ink-3">
                      {busy ? `busiest ${busy}` : list[0].title}
                    </span>
                  </>
                )}
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
