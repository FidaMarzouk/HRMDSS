import { cn } from "../../lib/utils";
import { LATTICE_STATES } from "./latticeStates";

// Lattice: a team drawn as people-squares, never a percentage.

export function LatticeCell({ status, className, title }) {
  const state = LATTICE_STATES[status] || LATTICE_STATES.out;
  return <i title={title} className={cn("block h-[15px] w-[15px] flex-none rounded-[3px]", state.cell, className)} />;
}

/**
 * people: [{ id, status, label }] where `label` describes the person for
 * tooltips and screen readers ("Rania Trabelsi, in since 08:04").
 */
export function Lattice({ people, className, label }) {
  return (
    <ul aria-label={label} className={cn("flex flex-wrap gap-1", className)}>
      {people.map((p) => (
        <li key={p.id}>
          <LatticeCell status={p.status} title={p.label} />
          <span className="sr-only">{p.label}</span>
        </li>
      ))}
    </ul>
  );
}

export function LatticeLegend({ states, className }) {
  return (
    <ul className={cn("flex flex-wrap gap-x-3 gap-y-1 text-xs text-ink-2", className)}>
      {states.map((s) => (
        <li key={s} className="flex items-center gap-1.5">
          <LatticeCell status={s} className="h-[11px] w-[11px]" />
          {LATTICE_STATES[s].label}
        </li>
      ))}
    </ul>
  );
}
