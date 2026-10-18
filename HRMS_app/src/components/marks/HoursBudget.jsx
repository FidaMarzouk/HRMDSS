import { cn } from "../../lib/utils";
import { Legend } from "./MarkFrame";
import { TONE, fmt } from "./palette";

/*
 * Hours budget per department: a bar of production hours, a black notch at
 * contracted hours (8 h 30 per expected day), amber hatching for the overtime
 * part, and the difference in mono.
 * rows: [{ id, name, worked, contracted, overtime, delta }]
 */
export function HoursBudget({ rows }) {
  const max = Math.max(1, ...rows.map((r) => Math.max(r.worked, r.contracted)));
  const pct = (v) => `${(v / max) * 100}%`;
  return (
    <div className="grid gap-2">
      <ul className="grid gap-2">
        {rows.map((r) => {
          const regular = Math.max(0, r.worked - r.overtime);
          return (
            <li key={r.id} className="grid grid-cols-[minmax(0,150px)_minmax(0,1fr)_64px] items-center gap-3">
              <span className="truncate text-[12.5px] text-ink-2" title={r.name}>{r.name}</span>
              <span
                className="relative h-4 rounded-[3px] bg-sunk"
                role="img"
                aria-label={`${r.name}: ${fmt.hours(r.worked)} worked of ${fmt.hours(r.contracted)} contracted, ${fmt.hours(r.overtime)} overtime`}
              >
                <span className="absolute inset-y-0 left-0 rounded-l-[3px] bg-teal" style={{ width: pct(regular) }} />
                {r.overtime > 0 && <span className="hatch-amber absolute inset-y-0" style={{ left: pct(regular), width: pct(r.overtime) }} />}
                <span className="absolute -inset-y-1 w-[2px] bg-ink" style={{ left: `calc(${pct(r.contracted)} - 1px)` }} />
              </span>
              <span className={cn("figure text-right text-[12.5px]", r.delta < 0 ? "text-amber" : "text-ink")}>
                {r.delta > 0 ? "+" : ""}
                {fmt.one(r.delta)} h
              </span>
            </li>
          );
        })}
      </ul>
      <Legend
        items={[
          { label: "Worked", color: TONE.teal },
          { label: "Overtime", className: "hatch-amber" },
          { label: "Contracted", className: "w-[2px] rounded-none bg-ink" },
        ]}
      />
    </div>
  );
}
