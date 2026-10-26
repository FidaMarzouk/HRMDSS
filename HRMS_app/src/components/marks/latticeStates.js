// Each presence status has its own shape treatment as well as a colour
// (see the status grammar), so the lattice reads without colour too.
export const LATTICE_STATES = {
  in: { label: "In", cell: "bg-teal" },
  late: { label: "Late", cell: "border-2 border-amber bg-amber/15" },
  left: { label: "Left for the day", cell: "border-2 border-teal" },
  mission: { label: "On mission", cell: "bg-ink-3" },
  leave: { label: "On leave", cell: "border-2 border-ink-2" },
  out: { label: "Not in", cell: "bg-line-2" },
  absent: { label: "Absent", cell: "border-2 border-dashed border-red" },
};
