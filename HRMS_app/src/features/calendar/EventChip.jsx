import { cn } from "../../lib/utils";
import { EVENT_TYPES, FallbackIcon, STATE_CHIP, STATE_LABEL, stateOf } from "./meta";
import { clock } from "./time";

// Compact event: type icon, time, title; the left edge shows the state.
export function EventChip({ event, onOpen, showTime = true, className }) {
  const state = stateOf(event);
  const { Icon = FallbackIcon, label } = EVENT_TYPES[event.eventType] || {};
  return (
    <button
      type="button"
      onClick={() => onOpen(event)}
      title={`${event.title} · ${label || "Event"} · ${STATE_LABEL[state]}`}
      className={cn("flex w-full min-w-0 items-center gap-1.5 rounded-[4px] bg-raise px-1.5 py-1 text-left text-[11.5px] text-ink hover:bg-sunk", STATE_CHIP[state], className)}
    >
      <Icon className="h-3 w-3 flex-none text-ink-3" aria-hidden />
      {showTime && <span className="figure flex-none text-ink-3">{clock(event.startDateTime)}</span>}
      <span className="truncate">{event.title}</span>
      <span className="sr-only">, {label}, {STATE_LABEL[state]}</span>
    </button>
  );
}

// One tick per event, in the month grid.
const TICK = {
  confirmed: "bg-teal",
  pending: "border border-dashed border-teal",
  clash: "bg-red",
  declined: "bg-line-2",
};
export function Tick({ state }) {
  return <i aria-hidden="true" className={cn("inline-block h-3 w-[5px] flex-none rounded-[1px]", TICK[state])} />;
}
