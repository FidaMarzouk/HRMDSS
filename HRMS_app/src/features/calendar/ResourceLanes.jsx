import { Fragment, useMemo } from "react";
import { Wrench } from "lucide-react";
import { cn } from "../../lib/utils";
import { companyDateTime } from "../../lib/dates";
import { EVENT_TYPES, FallbackIcon, RESOURCE_ORDER, RESOURCE_TYPES, STATE_BLOCK, STATE_LABEL } from "./meta";
import { clock, formatKey, spanOn, todayKey } from "./time";
import { packColumns } from "./layout";

// Each day column covers working hours.
const OPEN = 8 * 60;
const CLOSE = 18 * 60;
const SPAN = CLOSE - OPEN;
const LANE_PX = 46;

/**
 * Resource lanes: one row per bookable thing, one column per day (08:00–18:00).
 * Confirmed bookings solid teal, pending dashed, clashes outlined red.
 * data: GET /api/calendar/resources/week
 */
export function ResourceLanes({ data, showPending, onOpen, onBook }) {
  const today = todayKey();
  const days = data.days.map((d) => d.date);

  const groups = useMemo(() => {
    const byType = new Map();
    data.resources.forEach((r) => byType.set(r.type, [...(byType.get(r.type) || []), r]));
    return RESOURCE_ORDER.filter((t) => byType.has(t)).map((t) => ({ type: t, resources: byType.get(t) }));
  }, [data.resources]);

  // Bookings drawn in one lane cell, clipped to working hours, side by side when they overlap.
  const cellBlocks = (resource, day) =>
    packColumns(
      resource.bookings
        .filter((b) => (showPending || b.status === "approved") && touches(b, day))
        .map((b) => ({ booking: b, ...spanOn(b, day) }))
        .filter(({ from, to }) => to > OPEN && from < CLOSE)
        .map((i) => ({ ...i, from: Math.max(i.from, OPEN), to: Math.min(i.to, CLOSE) }))
    );

  return (
    <div className="overflow-x-auto rounded-lg border border-line">
      <div className="grid min-w-[760px]" style={{ gridTemplateColumns: `200px repeat(${days.length}, minmax(0, 1fr))` }}>
        <span className="sticky left-0 z-10 border-b border-line bg-panel" />
        {days.map((k) => (
          <span key={k} className={cn("border-b border-l border-line px-2 py-2 font-mono text-[10.5px] uppercase tracking-[0.08em]", k === today ? "font-semibold text-teal" : "text-ink-3")}>
            {formatKey(k)}
          </span>
        ))}

        {groups.map((g) => {
          const { Icon = FallbackIcon, label } = RESOURCE_TYPES[g.type] || {};
          return (
            <Fragment key={g.type}>
              <p className="sticky left-0 z-10 col-span-full flex items-center gap-1.5 border-b border-line bg-raise px-2.5 py-1 font-mono text-[10.5px] uppercase tracking-[0.1em] text-ink-3">
                <Icon className="h-3.5 w-3.5" aria-hidden /> {label}
              </p>
              {g.resources.map((r) => {
                const down = r.status === "maintenance";
                return (
                  <Fragment key={r.id}>
                    <div className="sticky left-0 z-10 flex min-w-0 flex-col justify-center border-b border-line bg-panel px-2.5" style={{ height: LANE_PX }}>
                      <span className="truncate text-[12.5px] text-ink" title={r.description || r.name}>{r.name}</span>
                      {down && (
                        <span className="flex items-center gap-1 text-[10.5px] text-amber">
                          <Wrench className="h-3 w-3" aria-hidden /> Under maintenance
                        </span>
                      )}
                    </div>
                    {days.map((k) => {
                      const blocks = cellBlocks(r, k);
                      return (
                        <div
                          key={k}
                          className={cn("group relative border-b border-l border-line", down ? "hatch-ink opacity-60" : "")}
                          style={{
                            height: LANE_PX,
                            backgroundImage: down ? undefined : `repeating-linear-gradient(90deg, transparent 0 calc(10% - 1px), var(--grid) calc(10% - 1px) 10%)`,
                          }}
                        >
                          {!down && onBook && (
                            <button
                              type="button"
                              onClick={() => onBook(r, k)}
                              aria-label={`Book ${r.name} on ${formatKey(k, { weekday: "long", day: "numeric", month: "long" })}`}
                              className="absolute inset-0 opacity-0 focus-visible:opacity-100 group-hover:bg-teal/[0.04]"
                            />
                          )}
                          {blocks.map(({ booking: b, from, to, col, cols }) => {
                            const { Icon: TypeIcon = FallbackIcon, label: typeLabel } = EVENT_TYPES[b.eventType] || {};
                            const clashText = b.clashesWith.length ? ` · overlaps ${b.clashesWith.map((c) => `${c.title} (${c.status})`).join(", ")}` : "";
                            return (
                              <button
                                key={`${b.id}-${k}`}
                                type="button"
                                onClick={() => onOpen(b)}
                                title={`${b.title} · ${clock(b.startDateTime)}–${clock(b.endDateTime)}${b.by ? ` · ${b.by.name}` : ""} · ${STATE_LABEL[b.state]}${clashText}`}
                                className={cn("absolute z-[1] flex items-center gap-1 overflow-hidden rounded-[4px] px-1 text-left text-[10.5px] leading-tight", STATE_BLOCK[b.state])}
                                style={{
                                  left: `${((from - OPEN) / SPAN) * 100}%`,
                                  width: `max(6px, calc(${((to - from) / SPAN) * 100}% - 1px))`,
                                  top: `calc(${(col / cols) * 100}% + 5px - ${(col / cols) * 10}px)`,
                                  height: `calc(${100 / cols}% - ${10 / cols}px - 1px)`,
                                }}
                              >
                                <TypeIcon className="h-3 w-3 flex-none opacity-80" aria-hidden />
                                <span className="truncate">{b.title}</span>
                                <span className="sr-only">, {typeLabel}, {clock(b.startDateTime)} to {clock(b.endDateTime)}, {STATE_LABEL[b.state]}{clashText}</span>
                              </button>
                            );
                          })}
                        </div>
                      );
                    })}
                  </Fragment>
                );
              })}
            </Fragment>
          );
        })}
      </div>
    </div>
  );
}

// True when the booking overlaps company day `day`.
function touches(booking, day) {
  const dayStart = new Date(companyDateTime(day, "00:00"));
  const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
  return new Date(booking.startDateTime) < dayEnd && new Date(booking.endDateTime) > dayStart;
}
