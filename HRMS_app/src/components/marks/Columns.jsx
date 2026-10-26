import { cn } from "../../lib/utils";
import { Legend } from "./MarkFrame";
import { TONE, fmt } from "./palette";

/*
 * Columns for a series over time or over bins (daily counts, months, histograms).
 * data: [{ key, label, [series.key]: number }]
 * series: [{ key, label, color? }] — two series are drawn side by side.
 * target: dashed reference line. labelEvery: show one x label in n.
 */
export function Columns({ data, series, format = fmt.int, height = 150, target, labelEvery, className }) {
  const values = data.flatMap((d) => series.map((s) => d[s.key] || 0));
  const max = Math.max(1, target || 0, ...values);
  const every = labelEvery || Math.max(1, Math.ceil(data.length / 10));
  const describe = data.map((d) => `${d.label}: ${series.map((s) => `${series.length > 1 ? `${s.label} ` : ""}${format(d[s.key])}`).join(", ")}`).join("; ");

  return (
    <div className={cn("grid gap-2", className)}>
      <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-2">
        <div className="flex flex-col justify-between text-right font-mono text-[10px] text-ink-3" style={{ height }} aria-hidden="true">
          <span>{format(max)}</span>
          {/* The middle label is skipped when rounding would repeat a neighbour (max 1 → "1, 1, 0"). */}
          <span>{format(max / 2) !== format(max) && format(max / 2) !== "0" ? format(max / 2) : ""}</span>
          <span>0</span>
        </div>
        <div className="relative" style={{ height }} role="img" aria-label={describe}>
          <span className="absolute inset-x-0 top-0 border-t border-line" />
          <span className="absolute inset-x-0 top-1/2 border-t border-line" />
          <span className="absolute inset-x-0 bottom-0 border-t border-line-2" />
          {target != null && <span className="absolute inset-x-0 border-t border-dashed border-ink-3" style={{ bottom: `${(target / max) * 100}%` }} />}
          <div className="absolute inset-0 flex items-end gap-[3px]">
            {data.map((d) => (
              <div key={d.key ?? d.label} className="flex h-full min-w-0 flex-1 items-end justify-center gap-px" title={`${d.label}: ${series.map((s) => `${s.label} ${format(d[s.key])}`).join(", ")}`}>
                {series.map((s, i) => (
                  <span
                    key={s.key}
                    className="block min-w-[2px] max-w-[28px] flex-1 rounded-t-[2px]"
                    style={{ height: `${((d[s.key] || 0) / max) * 100}%`, background: s.color || (i ? TONE.blue : TONE.teal) }}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
        <span />
        <div className="flex gap-[3px] font-mono text-[10px] text-ink-3" aria-hidden="true">
          {data.map((d, i) => (
            <span key={d.key ?? d.label} className="min-w-0 flex-1 overflow-visible whitespace-nowrap text-center">
              {i % every === 0 ? d.short ?? d.label : ""}
            </span>
          ))}
        </div>
      </div>
      {series.length > 1 && <Legend items={series.map((s, i) => ({ label: s.label, color: s.color || (i ? TONE.blue : TONE.teal) }))} />}
    </div>
  );
}

/*
 * Heat strip: one cell per hour (or any bin), darker teal = more.
 * cells: [{ key, label, value }]
 */
export function HeatStrip({ cells, format = fmt.int, labelEvery = 3 }) {
  const max = Math.max(1, ...cells.map((c) => c.value || 0));
  return (
    <div className="grid gap-1">
      <div className="flex gap-[2px]" role="img" aria-label={cells.filter((c) => c.value).map((c) => `${c.label}: ${format(c.value)}`).join(", ") || "No activity"}>
        {cells.map((c) => (
          <span
            key={c.key ?? c.label}
            title={`${c.label}: ${format(c.value)}`}
            className="h-8 min-w-0 flex-1 rounded-[2px] border border-line"
            style={{ background: c.value ? `rgb(var(--teal) / ${0.12 + 0.88 * (c.value / max)})` : "transparent" }}
          />
        ))}
      </div>
      <div className="flex gap-[2px] font-mono text-[10px] text-ink-3" aria-hidden="true">
        {cells.map((c, i) => (
          <span key={c.key ?? c.label} className="min-w-0 flex-1 overflow-visible whitespace-nowrap">
            {i % labelEvery === 0 ? c.short ?? c.label : ""}
          </span>
        ))}
      </div>
      <p className="text-[11px] text-ink-3">Darker = more. Busiest: {(() => { const top = [...cells].sort((a, b) => (b.value || 0) - (a.value || 0))[0]; return top?.value ? `${top.label} (${format(top.value)})` : "none"; })()}</p>
    </div>
  );
}
