import { cn } from "../../lib/utils";
import { Legend } from "./MarkFrame";
import { TONE, categorical, fmt } from "./palette";

/*
 * Ranked rows: a label, a horizontal bar and the value in mono. Replaces the
 * vertical bar charts by department/resource, which were hard to label.
 * items: [{ id?, label, value, note?, previous? }]; previous draws a thin tick.
 */
export function RankedBars({ items, format = fmt.int, color = TONE.teal, max, sort = true, labelWidth = 150 }) {
  const list = sort ? [...items].sort((a, b) => (b.value || 0) - (a.value || 0)) : items;
  const top = max ?? Math.max(1, ...list.map((i) => Math.max(i.value || 0, i.previous || 0)));
  return (
    <ul className="grid gap-1.5">
      {list.map((item, i) => (
        <li key={item.id ?? `${item.label}-${i}`} className="grid items-center gap-3" style={{ gridTemplateColumns: `minmax(0,${labelWidth}px) minmax(0,1fr) auto` }}>
          <span className="truncate text-[12.5px] text-ink-2" title={item.label}>{item.label}</span>
          <span className="relative h-3 rounded-[2px] bg-sunk" aria-hidden="true">
            <span className="absolute inset-y-0 left-0 rounded-[2px]" style={{ width: `${((item.value || 0) / top) * 100}%`, background: item.color || color }} />
            {item.previous != null && <span className="absolute -inset-y-0.5 w-[2px] bg-ink-3" style={{ left: `${(item.previous / top) * 100}%` }} />}
          </span>
          <span className="figure min-w-[3.5rem] text-right text-[12.5px] text-ink">
            {format(item.value)}
            {item.note && <span className="ml-1.5 text-ink-3">{item.note}</span>}
          </span>
        </li>
      ))}
    </ul>
  );
}

/*
 * Proportion strip: one bar split into parts (replaces pies and donuts).
 * parts: [{ label, value, color? }]
 */
export function ProportionStrip({ parts, format = fmt.int, showLegend = true, height = "h-3", className }) {
  const total = parts.reduce((n, p) => n + (p.value || 0), 0);
  const colored = parts.map((p, i) => ({ ...p, color: p.color || categorical(i) }));
  return (
    <div className={cn("grid gap-2", className)}>
      <div className={cn("flex w-full overflow-hidden rounded-[3px] bg-sunk", height)} role="img" aria-label={colored.map((p) => `${p.label} ${format(p.value)}`).join(", ")}>
        {total > 0 &&
          colored
            .filter((p) => p.value > 0)
            .map((p) => (
              <span key={p.label} title={`${p.label}: ${format(p.value)} (${Math.round((p.value / total) * 100)} %)`} className={cn("h-full border-r border-panel last:border-0", p.className)} style={{ width: `${(p.value / total) * 100}%`, background: p.className ? undefined : p.color }} />
            ))}
      </div>
      {showLegend && (
        <Legend items={colored.map((p) => ({ label: p.label, color: p.className ? undefined : p.color, className: p.className, value: `${format(p.value)}${total ? ` · ${Math.round((p.value / total) * 100)} %` : ""}` }))} />
      )}
    </div>
  );
}

/*
 * Stacked rows: one 100 % strip per row (e.g. present / late / absent by department).
 * rows: [{ id, label, parts: [{ label, value }] }]; series: [{ label, color, className }]
 */
export function StackedRows({ rows, series, format = fmt.pct }) {
  return (
    <div className="grid gap-2">
      <ul className="grid gap-1.5">
        {rows.map((r) => {
          const total = r.parts.reduce((n, p) => n + (p.value || 0), 0);
          return (
            <li key={r.id ?? r.label} className="grid grid-cols-[minmax(0,150px)_minmax(0,1fr)_auto] items-center gap-3">
              <span className="truncate text-[12.5px] text-ink-2" title={r.label}>{r.label}</span>
              <span className="flex h-3 overflow-hidden rounded-[2px] bg-sunk" role="img" aria-label={`${r.label}: ${r.parts.map((p, i) => `${series[i].label} ${format(p.value)}`).join(", ")}`}>
                {total > 0 &&
                  r.parts.map((p, i) =>
                    p.value > 0 ? <span key={series[i].label} className={cn("h-full", series[i].className)} style={{ width: `${(p.value / total) * 100}%`, background: series[i].className ? undefined : series[i].color }} /> : null
                  )}
              </span>
              <span className="figure text-right text-[12px] text-ink">{format(r.parts[0]?.value)}</span>
            </li>
          );
        })}
      </ul>
      <Legend items={series.map((s) => ({ label: s.label, color: s.className ? undefined : s.color, className: s.className }))} />
    </div>
  );
}

// A single measure against its maximum (leave days used, approval rate...).
export function Meter({ value, max = 100, label, valueText, color = TONE.teal, className }) {
  const pct = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
  return (
    <div className={cn("grid gap-1", className)}>
      {(label || valueText) && (
        <div className="flex items-baseline justify-between gap-2 text-[12.5px]">
          <span className="text-ink-2">{label}</span>
          <span className="figure text-ink">{valueText}</span>
        </div>
      )}
      <span className="block h-2 overflow-hidden rounded-full bg-sunk" role="meter" aria-valuenow={Math.round(value || 0)} aria-valuemin={0} aria-valuemax={max} aria-label={label}>
        <span className="block h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
      </span>
    </div>
  );
}

// Big figure with a caption, for single numbers inside a panel.
export function Figure({ value, label, detail, className }) {
  return (
    <div className={cn("flex flex-col gap-0.5 rounded-lg border-l-2 border-teal bg-raise px-3 py-2", className)}>
      <span className="text-[12px] text-ink-2">{label}</span>
      <span className="figure text-xl font-medium leading-tight text-ink">{value}</span>
      {detail && <span className="text-[11.5px] text-ink-3">{detail}</span>}
    </div>
  );
}
