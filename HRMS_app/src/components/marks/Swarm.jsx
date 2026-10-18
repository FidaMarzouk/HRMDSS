import { TONE, fmt } from "./palette";
import { Legend } from "./MarkFrame";

/*
 * Arrival swarm: per department, one dot per arrival on a 07:30–10:00 track,
 * stacked where they collide; amber line at 08:30, median tick, and the
 * previous period's median as a hollow tick. Late count on the right.
 * groups: [{ id, name, current: [minutes], medianCurrent, medianPrevious, lateCurrent, latePrevious }]
 */
const START = 7 * 60 + 30;
const END = 10 * 60;
const LATE = 8 * 60 + 30;
const W = 600;
const R = 2.4;
const STEP = 2 * R + 0.6;
const MAX_STACK = 6;
const x = (m) => ((Math.max(START, Math.min(END, m)) - START) / (END - START)) * W;

function stack(minutes) {
  // Bin by dot width, then stack alternately above and below the axis.
  const bins = new Map();
  const dots = [];
  [...minutes].sort((a, b) => a - b).forEach((m) => {
    const bin = Math.round(x(m) / (2 * R));
    const n = bins.get(bin) || 0;
    bins.set(bin, n + 1);
    if (n >= MAX_STACK * 2) return; // dense bins are capped; the table keeps exact counts
    const level = Math.ceil(n / 2) * (n % 2 ? -1 : 1);
    dots.push({ cx: bin * 2 * R, cy: level * STEP, late: m > LATE });
  });
  return dots;
}

export function SwarmAxis() {
  const ticks = [START, 8 * 60, LATE, 9 * 60, 9 * 60 + 30, END];
  return (
    <div className="relative h-4 font-mono text-[10px] text-ink-3" aria-hidden="true">
      {ticks.map((t) => (
        <span key={t} className="absolute -translate-x-1/2" style={{ left: `${(x(t) / W) * 100}%` }}>
          {fmt.clock(t)}
        </span>
      ))}
    </div>
  );
}

export function Swarm({ groups }) {
  const h = MAX_STACK * STEP * 2 + 6;
  return (
    <div className="grid gap-1">
      <div className="grid grid-cols-[minmax(0,150px)_minmax(0,1fr)_56px] items-end gap-3">
        <span />
        <SwarmAxis />
        <span className="text-right font-mono text-[10px] uppercase tracking-[0.08em] text-ink-3">Late</span>
      </div>
      {groups.map((g) => {
        const dots = stack(g.current);
        return (
          <div key={g.id} className="grid grid-cols-[minmax(0,150px)_minmax(0,1fr)_56px] items-center gap-3 border-t border-line py-1">
            <span className="truncate text-[12.5px] text-ink-2" title={g.name}>{g.name}</span>
            <svg
              viewBox={`0 ${-h / 2} ${W} ${h}`}
              className="h-auto w-full overflow-visible"
              role="img"
              aria-label={`${g.name}: ${g.current.length} arrivals, median ${fmt.clock(g.medianCurrent)}${g.medianPrevious != null ? ` (previous ${fmt.clock(g.medianPrevious)})` : ""}, ${g.lateCurrent} late`}
            >
              <line x1={0} x2={W} y1={0} y2={0} stroke={TONE.line} />
              <line x1={x(LATE)} x2={x(LATE)} y1={-h / 2} y2={h / 2} stroke={TONE.amber} strokeWidth={1.2} />
              {dots.map((d, i) => (
                <circle key={i} cx={d.cx} cy={d.cy} r={R} fill={d.late ? TONE.amber : TONE.teal} fillOpacity={0.85} />
              ))}
              {g.medianPrevious != null && (
                <line x1={x(g.medianPrevious)} x2={x(g.medianPrevious)} y1={-h / 2 + 2} y2={h / 2 - 2} stroke={TONE.ink3} strokeWidth={1.5} strokeDasharray="2 2" />
              )}
              {g.medianCurrent != null && <line x1={x(g.medianCurrent)} x2={x(g.medianCurrent)} y1={-h / 2 + 1} y2={h / 2 - 1} stroke={TONE.ink} strokeWidth={2} />}
            </svg>
            <span className="figure text-right text-[12.5px]">
              <span className={g.lateCurrent > g.latePrevious ? "text-amber" : "text-ink"}>{g.lateCurrent}</span>
              <span className="text-ink-3"> /{g.latePrevious}</span>
            </span>
          </div>
        );
      })}
      <Legend
        className="mt-1"
        items={[
          { label: "On time", color: TONE.teal },
          { label: "Late (after 08:30)", color: TONE.amber },
          { label: "Median", color: TONE.ink },
          { label: "Previous median (dashed)", color: TONE.ink3 },
        ]}
      />
      <p className="text-[11px] text-ink-3">Late column: this period / previous period. Arrivals before 07:30 or after 10:00 sit on the track ends.</p>
    </div>
  );
}
