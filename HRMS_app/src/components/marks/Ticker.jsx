import { cn } from "../../lib/utils";
import { TONE, fmt } from "./palette";

/*
 * Ticker (replaces KPI cards): the figure, its change against the previous
 * period, one tick per workday against a target, and a "Why?" link.
 *   better: "up" when a higher value is good, "down" when lower is good,
 *           "neutral" when the change is not good or bad in itself
 *   unit: "%" (change shown in points), "h", or "" for counts
 *   daily: [{ date, value }]; target: drawn dashed, ticks below it are amber
 */
export function Ticker({ label, value, previous, unit = "", better = "up", detail, daily, target, why, className, loading }) {
  const has = value != null;
  const delta = has && previous != null ? value - previous : null;
  const good = delta == null || delta === 0 || better === "neutral" ? null : better === "up" ? delta > 0 : delta < 0;
  const deltaText =
    delta == null ? "no previous data" : delta === 0 ? "no change" : `${delta > 0 ? "▲" : "▼"} ${fmt.one(Math.abs(delta))}${unit === "%" ? " pts" : unit ? ` ${unit}` : ""}`;

  const values = (daily || []).map((d) => d.value).filter((v) => v != null);
  const top = Math.max(target || 0, ...values, 1);
  const bottom = unit === "%" ? Math.min(target ?? 100, ...values) - 5 : 0;
  const scale = (v) => Math.max(2, ((v - bottom) / (top - bottom)) * 100);

  return (
    <div className={cn("flex min-w-0 flex-col gap-1.5 rounded-xl border border-line bg-panel p-3.5", className)}>
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-[13px] font-medium text-ink">{label}</p>
        {detail && <p className="truncate text-[11.5px] text-ink-3">{detail}</p>}
      </div>
      <div className="flex items-baseline gap-2.5">
        <p className={cn("figure text-[26px] font-medium leading-none text-ink", loading && "animate-pulse rounded bg-sunk text-transparent")}>
          {loading ? "00.0" : has ? (unit === "%" ? fmt.one(value) : unit === "h" ? fmt.one(value) : fmt.int(value)) : "—"}
          {has && unit && <span className="ml-1 text-[15px] text-ink-2">{unit === "%" ? "%" : unit}</span>}
        </p>
        {!loading && (
          <p className={cn("figure text-[12px]", good === null ? "text-ink-3" : good ? "text-teal" : "text-amber")}>
            {deltaText}
            <span className="sr-only"> against the previous period{good === null ? "" : good ? ", better" : ", worse"}</span>
          </p>
        )}
      </div>
      {daily?.length > 0 && (
        <div className="relative mt-1 flex h-8 items-end gap-[2px]" aria-hidden="true">
          {target != null && (
            <span className="absolute inset-x-0 border-t border-dashed border-ink-3" style={{ bottom: `${scale(target)}%` }} />
          )}
          {daily.map((d) => (
            <i
              key={d.date}
              title={`${d.date}: ${d.value == null ? "no data" : unit === "%" ? fmt.pct(d.value) : fmt.one(d.value)}`}
              className="min-w-[2px] flex-1 rounded-[1px]"
              style={{
                height: d.value == null ? "2px" : `${scale(d.value)}%`,
                background: d.value == null ? TONE.line : target != null && (better === "down" ? d.value > target : d.value < target) ? TONE.amber : TONE.teal,
              }}
            />
          ))}
        </div>
      )}
      <div className="flex items-center justify-between gap-2 text-[11px] text-ink-3">
        <span>{target != null ? `dashed = ${unit === "%" ? `${target} % target` : `${target}${unit ? ` ${unit}` : ""} target`}` : daily?.length ? "one tick per workday" : ""}</span>
        {why && (
          <a href={why} className="text-teal hover:underline">
            Why? →
          </a>
        )}
      </div>
    </div>
  );
}
