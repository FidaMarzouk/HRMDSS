import { cn } from "../../lib/utils";
import { formatDay } from "../../lib/dates";
import { Legend } from "./MarkFrame";
import { TONE, fmt } from "./palette";

/*
 * Attendance barcode: one thin stripe per working day per person.
 * Teal present, amber late, empty (outlined) absent, hatched leave, faint no record.
 * rows: [{ id, name, cells: ["present" | "late" | "absent" | "leave" | null], rate }]
 */
const CELL = {
  present: { className: "bg-teal", label: "present" },
  late: { className: "bg-amber", label: "late" },
  absent: { className: "border border-red/70 bg-transparent", label: "absent" },
  leave: { className: "hatch-ink", label: "on leave" },
};

export function BarcodeRow({ days, cells, className }) {
  return (
    <span className={cn("flex h-5 min-w-0 flex-1 items-stretch gap-px", className)} aria-hidden="true">
      {cells.map((c, i) => (
        <i
          key={days[i] || i}
          title={`${formatDay(days[i], { weekday: "short", day: "numeric", month: "short" })}: ${c ? CELL[c].label : "no record"}`}
          className={cn("min-w-[2px] flex-1 rounded-[1px]", c ? CELL[c].className : "bg-sunk")}
        />
      ))}
    </span>
  );
}

const summary = (cells) => {
  const n = (s) => cells.filter((c) => c === s).length;
  return `${n("present")} present, ${n("late")} late, ${n("absent")} absent, ${n("leave")} on leave`;
};

export function Barcode({ days, rows, groupBy = "department" }) {
  const groups = [];
  rows.forEach((r) => {
    const key = r[groupBy] || "";
    let g = groups.find((x) => x.key === key);
    if (!g) groups.push((g = { key, rows: [] }));
    g.rows.push(r);
  });
  groups.sort((a, b) => a.key.localeCompare(b.key));

  return (
    <div className="grid gap-2">
      <div className="max-h-[420px] overflow-y-auto pr-1">
        {groups.map((g) => (
          <div key={g.key} className="mb-2">
            {g.key && <p className="label-key mb-1 mt-1">{g.key}</p>}
            <ul className="grid gap-1">
              {[...g.rows].sort((a, b) => a.name.localeCompare(b.name)).map((r) => (
                <li key={r.id} className="flex items-center gap-3">
                  <span className="w-36 flex-none truncate text-[12.5px] text-ink-2" title={r.name}>{r.name}</span>
                  <BarcodeRow days={days} cells={r.cells} />
                  <span className="sr-only">{summary(r.cells)}</span>
                  <span className="figure w-14 flex-none text-right text-[12.5px] text-ink">{r.rate == null ? "—" : fmt.pct(r.rate)}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <Legend
        items={[
          { label: "Present", color: TONE.teal },
          { label: "Late", color: TONE.amber },
          { label: "Absent", className: "border border-red/70" },
          { label: "On leave", className: "hatch-ink" },
          { label: "No record", className: "bg-sunk" },
        ]}
      />
    </div>
  );
}
