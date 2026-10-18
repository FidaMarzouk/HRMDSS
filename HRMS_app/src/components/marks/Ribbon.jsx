import { cn } from "../../lib/utils";

// Ribbon: one person's day on a 07:00-19:00 track. Work teal, breaks grey,
// late arrival amber (from 08:30), overtime hatched (after 18:00), a missing
// punch-out dashed red; leave and absence fill the track.
const START = 7 * 60;
const SPAN = 12 * 60;
const LATE_LINE = 8 * 60 + 30;
const DAY_END = 18 * 60;

const minutesOf = (d) => {
  const x = new Date(d);
  return x.getHours() * 60 + x.getMinutes();
};
const pct = (m) => Math.max(0, Math.min(100, ((m - START) / SPAN) * 100));
const span = (from, to) => ({ left: `${pct(from)}%`, width: `${Math.max(0.4, pct(to) - pct(from))}%` });

/**
 * sessions: [{ checkIn, checkOut, breaks: [{ startTime, endTime }] }]
 * missing: true when an open session is a forgotten punch-out (draw dashed red)
 * nowMinutes: for today's open sessions
 */
export function Ribbon({ sessions = [], late = false, missing = false, leave, absent = false, mission = false, nowMinutes, className, label }) {
  const parts = [];
  sessions.forEach((s, i) => {
    if (!s.checkIn) return;
    const inM = minutesOf(s.checkIn);
    const open = !s.checkOut;
    const endM = open ? (missing ? DAY_END : nowMinutes ?? DAY_END) : minutesOf(s.checkOut);
    const breaks = (s.breaks || [])
      .filter((b) => b.startTime)
      .map((b) => [minutesOf(b.startTime), b.endTime ? minutesOf(b.endTime) : Math.min(endM, nowMinutes ?? endM)])
      .sort((a, b) => a[0] - b[0]);

    // Work segments between breaks, split at 18:00 for overtime.
    let cursor = inM;
    const workTo = (to) => {
      if (to <= cursor) return;
      const normalEnd = Math.min(to, DAY_END);
      if (normalEnd > cursor) parts.push({ kind: "work", from: cursor, to: normalEnd, key: `w${i}-${cursor}` });
      if (to > DAY_END) parts.push({ kind: "over", from: Math.max(cursor, DAY_END), to, key: `o${i}-${cursor}` });
      cursor = to;
    };
    breaks.forEach(([bs, be]) => {
      workTo(Math.max(cursor, bs));
      parts.push({ kind: "break", from: bs, to: be, key: `b${i}-${bs}` });
      cursor = Math.max(cursor, be);
    });
    if (open && missing) {
      parts.push({ kind: "missing", from: cursor, to: DAY_END, key: `m${i}` });
    } else {
      workTo(endM);
    }
  });

  const firstIn = sessions.find((s) => s.checkIn)?.checkIn;
  const lateFrom = late && firstIn ? minutesOf(firstIn) : null;

  return (
    <div role="img" aria-label={label} className={cn("relative h-4 rounded bg-sunk", className)}>
      <span className="absolute -bottom-0.5 -top-0.5 w-px bg-line-2" style={{ left: `${pct(LATE_LINE)}%` }} aria-hidden="true" />
      {leave && <span className="absolute inset-y-[3px] left-[8.3%] right-[8.3%] rounded-[3px] border-2 border-ink-3" aria-hidden="true" />}
      {mission && !sessions.length && <span className="absolute inset-y-[3px] left-[8.3%] right-[8.3%] rounded-[3px] bg-ink-3" aria-hidden="true" />}
      {absent && !sessions.length && <span className="absolute inset-y-[2px] left-[8.3%] right-[8.3%] rounded-[3px] border-[1.5px] border-dashed border-red" aria-hidden="true" />}
      {lateFrom != null && lateFrom > LATE_LINE && (
        <span className="absolute top-[6px] h-1 bg-amber" style={span(LATE_LINE, lateFrom)} aria-hidden="true" />
      )}
      {parts.map((p) => (
        <span
          key={p.key}
          aria-hidden="true"
          style={span(p.from, p.to)}
          className={cn(
            "absolute",
            p.kind === "work" && "inset-y-[3px] rounded-[3px] bg-teal",
            p.kind === "break" && "inset-y-[6px] rounded-sm bg-ink-3",
            p.kind === "over" && "hatch-teal inset-y-[3px] rounded-[3px]",
            p.kind === "missing" && "inset-y-[2px] rounded-[3px] border-[1.5px] border-dashed border-red"
          )}
        />
      ))}
    </div>
  );
}

export function RibbonAxis({ className }) {
  return (
    <div aria-hidden="true" className={cn("flex justify-between font-mono text-[10px] text-ink-3", className)}>
      <span>07</span><span>10</span><span>13</span><span>16</span><span>19</span>
    </div>
  );
}

export function RibbonLegend({ className }) {
  const item = (cls, text) => (
    <span className="flex items-center gap-1.5">
      <i className={cn("block h-2.5 w-4 rounded-sm", cls)} />
      {text}
    </span>
  );
  return (
    <div className={cn("flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-ink-3", className)}>
      {item("bg-teal", "worked")}
      {item("h-1 bg-ink-3", "break")}
      {item("h-1 bg-amber", "late after 08:30")}
      {item("hatch-teal", "overtime")}
      {item("border-[1.5px] border-dashed border-red", "missing punch")}
      {item("border-2 border-ink-3", "on leave")}
    </div>
  );
}
