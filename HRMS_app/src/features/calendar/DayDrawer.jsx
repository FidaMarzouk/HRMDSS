import { Plus, Rows3 } from "lucide-react";
import { Drawer } from "../../components/ui/dialog";
import { Button } from "../../components/ui/button";
import { cn } from "../../lib/utils";
import { EVENT_TYPES, FallbackIcon, STATE_BLOCK, STATE_LABEL, stateOf } from "./meta";
import { clock, daysOfEvent, formatKey, spanOn } from "./time";

const START = 7 * 60;
const END = 20 * 60;
const SPAN = END - START;

/** One day as lanes: a row per event on a 07:00–20:00 track. */
export function DayDrawer({ day, events, onClose, onOpen, onCreate, onShowResources }) {
  const list = day
    ? events
        .filter((e) => daysOfEvent(e).includes(day))
        .sort((a, b) => new Date(a.startDateTime) - new Date(b.startDateTime))
    : [];
  return (
    <Drawer
      open={Boolean(day)}
      onClose={onClose}
      title={day ? formatKey(day, { weekday: "long", day: "numeric", month: "long", year: "numeric" }) : ""}
      description={`${list.length} event${list.length === 1 ? "" : "s"}`}
      footer={
        <>
          <Button variant="secondary" onClick={() => onShowResources(day)}>
            <Rows3 aria-hidden /> Resource lanes
          </Button>
          <Button onClick={() => onCreate(day)}>
            <Plus aria-hidden /> New event
          </Button>
        </>
      }
    >
      <div className="grid gap-1">
        <div className="relative ml-[148px] h-4 font-mono text-[10px] text-ink-3" aria-hidden="true">
          {[8, 10, 12, 14, 16, 18].map((h) => (
            <span key={h} className="absolute -translate-x-1/2" style={{ left: `${((h * 60 - START) / SPAN) * 100}%` }}>{String(h).padStart(2, "0")}</span>
          ))}
        </div>
        {list.length === 0 && <p className="py-6 text-center text-[13px] text-ink-3">Nothing planned.</p>}
        <ul className="grid gap-1.5">
          {list.map((e) => {
            const state = stateOf(e);
            const { Icon = FallbackIcon, label } = EVENT_TYPES[e.eventType] || {};
            const { from, to } = spanOn(e, day);
            const a = Math.max(from, START);
            const b = Math.min(to, END);
            return (
              <li key={e._id}>
                <button type="button" onClick={() => onOpen(e)} className="grid w-full grid-cols-[140px_minmax(0,1fr)] items-center gap-2 rounded-md text-left hover:bg-sunk">
                  <span className="min-w-0 px-1">
                    <span className="block truncate text-[12.5px] text-ink">{e.title}</span>
                    <span className="figure block text-[10.5px] text-ink-3">{clock(e.startDateTime)}–{clock(e.endDateTime)}</span>
                  </span>
                  <span className="relative h-7 rounded-[4px] bg-sunk/60">
                    {b > a && (
                      <span className={cn("absolute inset-y-1 flex items-center gap-1 overflow-hidden rounded-[3px] px-1 text-[10.5px]", STATE_BLOCK[state])} style={{ left: `${((a - START) / SPAN) * 100}%`, width: `max(6px, ${((b - a) / SPAN) * 100}%)` }}>
                        <Icon className="h-3 w-3 flex-none" aria-hidden />
                      </span>
                    )}
                    <span className="sr-only">{label}, {STATE_LABEL[state]}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </Drawer>
  );
}
