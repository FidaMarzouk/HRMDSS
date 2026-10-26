import { Lattice, LatticeLegend } from "../../components/marks/Lattice";
import { LATTICE_STATES } from "../../components/marks/latticeStates";
import { formatClock } from "../time/sessions";

const describe = (p) => {
  const name = `${p.firstName} ${p.lastName}`;
  const state = LATTICE_STATES[p.status]?.label.toLowerCase() || "not in";
  if ((p.status === "in" || p.status === "late") && p.since) return `${name}, ${state} since ${formatClock(p.since)}${p.onBreak ? ", on break" : ""}`;
  return `${name}, ${state}`;
};

const shortName = (p) => `${p.firstName} ${p.lastName?.[0] || ""}.`;

// "On the floor now": each department as a row of people-squares.
export function FloorPanel({ data, loading }) {
  if (loading) {
    return (
      <div aria-busy="true" className="space-y-3 pt-2">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-10 animate-pulse rounded-md bg-sunk" />
        ))}
      </div>
    );
  }
  const departments = data?.departments || [];
  if (!departments.length) return <p className="pt-2 text-sm text-ink-2">No one to show yet.</p>;

  const used = Object.keys(LATTICE_STATES).filter((s) => departments.some((d) => d.people.some((p) => p.status === s)));

  return (
    <div className="space-y-3">
      {departments.map((d) => {
        const late = d.people.filter((p) => p.lateToday && (p.status === "late" || p.status === "left"));
        return (
          <div key={d.id} className="space-y-1">
            <div className="flex items-baseline justify-between gap-2 text-xs">
              <span className="truncate">{d.name}</span>
              <span className="figure flex-none text-ink-3">
                {d.summary.in}/{d.summary.total}
              </span>
            </div>
            <Lattice people={d.people.map((p) => ({ id: p.id, status: p.status, label: describe(p) }))} label={`${d.name}: ${d.summary.in} of ${d.summary.total} in`} />
            {late.length > 0 && (
              <p className="figure truncate text-[11px] text-amber">
                LATE · {late.map((p) => `${shortName(p)} ${p.lateBy ? `+${p.lateBy}m` : ""}`.trim()).join(" · ")}
              </p>
            )}
          </div>
        );
      })}
      <LatticeLegend states={used} className="border-t border-line pt-2" />
    </div>
  );
}
