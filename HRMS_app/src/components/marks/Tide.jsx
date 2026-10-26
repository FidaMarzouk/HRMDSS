import { formatDay } from "../../lib/dates";
import { Legend } from "./MarkFrame";
import { TONE } from "./palette";

/*
 * Leave tide: one column per coming working day. Approved leave solid teal,
 * pending requests as outlined boxes on top, the coverage limit as a dashed
 * red line, the peak day labelled.
 * columns: [{ date, approved, pending }], limit, peak: { date, total }
 */
const W = 640;
const H = 150;
const PAD_TOP = 18;
const PAD_BOTTOM = 18;

export function Tide({ columns, limit, peak }) {
  const top = Math.max(limit || 0, ...columns.map((c) => c.approved + c.pending), 1) + 1;
  const unit = (H - PAD_TOP - PAD_BOTTOM) / top;
  const slot = W / columns.length;
  const bw = Math.max(3, slot - 3);
  const y = (n) => H - PAD_BOTTOM - n * unit;
  const peakIndex = peak ? columns.findIndex((c) => c.date === peak.date) : -1;

  return (
    <div className="grid gap-2">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={`Leave over the next ${columns.length} working days. Limit ${limit} away. Peak ${peak ? `${peak.total} on ${formatDay(peak.date)}` : "none"}.`}>
        {columns.map((c, i) => {
          const x0 = i * slot + (slot - bw) / 2;
          const monday = new Date(`${c.date}T12:00:00Z`).getUTCDay() === 1;
          return (
            <g key={c.date}>
              {monday && (
                <text x={x0} y={H - 4} fontSize="9" fill={TONE.ink3} fontFamily="IBM Plex Mono, monospace">
                  {formatDay(c.date, { day: "numeric", month: "short" })}
                </text>
              )}
              <rect x={x0} y={y(0) - 0.5} width={bw} height={1} fill={TONE.line2} />
              {c.approved > 0 && <rect x={x0} y={y(c.approved)} width={bw} height={c.approved * unit} fill={TONE.teal} rx={1} />}
              {Array.from({ length: c.pending }, (_, k) => (
                <rect key={k} x={x0 + 0.75} y={y(c.approved + k + 1) + 0.75} width={bw - 1.5} height={unit - 1.5} fill="none" stroke={TONE.teal} strokeWidth={1.2} strokeDasharray="2 1.5" rx={1} />
              ))}
              <title>{`${formatDay(c.date, { weekday: "short", day: "numeric", month: "short" })}: ${c.approved} approved, ${c.pending} pending`}</title>
            </g>
          );
        })}
        {limit != null && (
          <g>
            <line x1={0} x2={W} y1={y(limit)} y2={y(limit)} stroke={TONE.red} strokeWidth={1.2} strokeDasharray="5 4" />
            <text x={W} y={y(limit) - 4} textAnchor="end" fontSize="9.5" fill={TONE.red} fontFamily="IBM Plex Mono, monospace" letterSpacing="0.08em">
              MAX {limit} AWAY
            </text>
          </g>
        )}
        {peakIndex >= 0 && peak.total > 0 && (
          <text x={Math.min(W - 60, Math.max(0, peakIndex * slot))} y={Math.max(10, y(peak.total) - 5)} fontSize="9.5" fill={TONE.ink} fontFamily="IBM Plex Mono, monospace">
            peak {peak.total}
          </text>
        )}
      </svg>
      <Legend
        items={[
          { label: "Approved", color: TONE.teal },
          { label: "Pending", className: "border border-dashed border-teal" },
          { label: "Coverage limit", className: "h-0 w-3 rounded-none border-t border-dashed border-red" },
        ]}
      />
    </div>
  );
}
