import { useMemo } from "react";
import { MapPin } from "lucide-react";
import { StatusPill } from "../../components/ui/status-pill";
import { EVENT_TYPES, FallbackIcon, STATE_LABEL, STATE_PILL, stateOf } from "./meta";
import { clock, daysOfEvent, formatKey, todayKey } from "./time";

const whereOf = (e) => e.resource?.name || e.location || e.destination || "";

/** Agenda: the period's events grouped by day. */
export function ListView({ events, from, to, onOpen }) {
  const today = todayKey();
  const groups = useMemo(() => {
    const map = new Map();
    events.forEach((e) =>
      daysOfEvent(e)
        .filter((k) => k >= from && k <= to)
        .forEach((k) => map.set(k, [...(map.get(k) || []), e]))
    );
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [events, from, to]);

  if (!groups.length) return <p className="py-10 text-center text-[13px] text-ink-3">No events in this period for the selected filters.</p>;

  return (
    <div className="grid gap-4">
      {groups.map(([k, list]) => (
        <section key={k} aria-label={formatKey(k, { weekday: "long", day: "numeric", month: "long" })}>
          <h3 className={k === today ? "label-key mb-1 text-teal" : "label-key mb-1"}>{formatKey(k, { weekday: "long", day: "numeric", month: "long" })}{k === today ? " · today" : ""}</h3>
          <ul className="divide-y divide-line rounded-lg border border-line">
            {list.map((e) => {
              const state = stateOf(e);
              const { Icon = FallbackIcon, label } = EVENT_TYPES[e.eventType] || {};
              return (
                <li key={`${e._id}-${k}`}>
                  <button type="button" onClick={() => onOpen(e)} className="grid w-full grid-cols-[96px_20px_minmax(0,1fr)_auto] items-center gap-3 px-3 py-2.5 text-left hover:bg-sunk">
                    <span className="figure text-[12.5px] text-ink-2">{clock(e.startDateTime)}–{clock(e.endDateTime)}</span>
                    <Icon className="h-4 w-4 text-ink-3" aria-label={label} />
                    <span className="min-w-0">
                      <span className="block truncate text-[13.5px] text-ink">{e.title}</span>
                      {whereOf(e) && (
                        <span className="flex items-center gap-1 truncate text-[12px] text-ink-3">
                          <MapPin className="h-3 w-3" aria-hidden /> {whereOf(e)}
                        </span>
                      )}
                    </span>
                    <StatusPill status={STATE_PILL[state]}>{STATE_LABEL[state]}</StatusPill>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
