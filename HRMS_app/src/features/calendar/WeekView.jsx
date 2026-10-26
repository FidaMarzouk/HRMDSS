import { useMemo } from "react";
import { cn } from "../../lib/utils";
import { EVENT_TYPES, FallbackIcon, STATE_BLOCK, STATE_LABEL, stateOf } from "./meta";
import { clock, daysOfEvent, formatKey, range, spanOn, todayKey } from "./time";
import { packColumns } from "./layout";

const FIRST_HOUR = 7;
const LAST_HOUR = 20;
const HOUR_PX = 46;
const SPAN = (LAST_HOUR - FIRST_HOUR) * 60;

/** Week: Monday to Sunday on a 07:00–20:00 grid; overlapping events sit side by side. */
export function WeekView({ monday, events, onOpen, onOpenDay }) {
  const days = range(monday, 7);
  const today = todayKey();
  const byDay = useMemo(() => {
    const map = new Map(days.map((k) => [k, []]));
    events.forEach((e) =>
      daysOfEvent(e).forEach((k) => {
        if (!map.has(k)) return;
        const { from, to } = spanOn(e, k);
        const clipFrom = Math.max(from, FIRST_HOUR * 60);
        const clipTo = Math.min(to, LAST_HOUR * 60);
        if (clipTo <= clipFrom) return;
        map.get(k).push({ event: e, from: clipFrom, to: clipTo });
      })
    );
    return new Map([...map.entries()].map(([k, list]) => [k, packColumns(list)]));
  }, [events, days]);

  return (
    <div className="overflow-x-auto">
      <div className="grid min-w-[760px] grid-cols-[48px_repeat(7,minmax(0,1fr))]">
        <span />
        {days.map((k) => (
          <button key={k} type="button" onClick={() => onOpenDay(k)} className={cn("border-b border-line px-1 pb-1.5 text-center text-[12px] hover:text-teal", k === today ? "font-semibold text-teal" : "text-ink-2")}>
            {formatKey(k)}
          </button>
        ))}
        <div className="relative" style={{ height: (LAST_HOUR - FIRST_HOUR) * HOUR_PX }} aria-hidden="true">
          {Array.from({ length: LAST_HOUR - FIRST_HOUR }, (_, i) => (
            <span key={i} className="absolute right-1.5 -translate-y-1/2 font-mono text-[10px] text-ink-3" style={{ top: i * HOUR_PX }}>
              {i ? `${String(FIRST_HOUR + i).padStart(2, "0")}:00` : ""}
            </span>
          ))}
        </div>
        {days.map((k, d) => (
          <div
            key={k}
            className={cn("relative border-l border-line", d >= 5 && "bg-sunk/40", k === today && "bg-teal/[0.04]")}
            style={{ height: (LAST_HOUR - FIRST_HOUR) * HOUR_PX, backgroundImage: `repeating-linear-gradient(to bottom, transparent 0 ${HOUR_PX - 1}px, var(--grid) ${HOUR_PX - 1}px ${HOUR_PX}px)` }}
          >
            {byDay.get(k).map(({ event, from, to, col, cols }) => {
              const state = stateOf(event);
              const { Icon = FallbackIcon, label } = EVENT_TYPES[event.eventType] || {};
              const height = ((to - from) / SPAN) * 100;
              return (
                <button
                  key={`${event._id}-${k}`}
                  type="button"
                  onClick={() => onOpen(event)}
                  title={`${event.title} · ${clock(event.startDateTime)}–${clock(event.endDateTime)} · ${STATE_LABEL[state]}`}
                  className={cn("absolute overflow-hidden rounded-[4px] px-1 py-0.5 text-left text-[11px] leading-tight", STATE_BLOCK[state])}
                  style={{ top: `${((from - FIRST_HOUR * 60) / SPAN) * 100}%`, height: `calc(${height}% - 2px)`, left: `calc(${(col / cols) * 100}% + 1px)`, width: `calc(${100 / cols}% - 2px)` }}
                >
                  <span className="flex items-center gap-1">
                    <Icon className="h-3 w-3 flex-none opacity-80" aria-hidden />
                    <span className="truncate font-medium">{event.title}</span>
                  </span>
                  {height > 6 && <span className="figure block truncate opacity-80">{clock(event.startDateTime)}–{clock(event.endDateTime)}</span>}
                  <span className="sr-only">, {label}, {STATE_LABEL[state]}</span>
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
