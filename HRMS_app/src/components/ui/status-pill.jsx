import { cn } from "../../lib/utils";

// Status grammar: every state has its own glyph as well as a colour, so it
// still reads for colour-blind users and in greyscale prints.
const STATUS = {
  present: { label: "Present", pill: "border-teal/40 text-ink", glyph: "rounded-full bg-teal" },
  late: { label: "Late", pill: "border-amber text-amber", glyph: "rounded-full border-2 border-amber glyph-half" },
  leave: { label: "On leave", pill: "border-line-2 text-ink-2", glyph: "h-2 w-2 rotate-45 border-2 border-ink-2" },
  mission: { label: "On mission", pill: "border-line-2 text-ink-2", glyph: "h-2 w-2 rotate-45 bg-ink-2" },
  absent: { label: "Absent", pill: "border-dashed border-red text-red", glyph: "rounded-sm border-2 border-dashed border-red" },
  pending: { label: "Pending", pill: "border-teal/40 text-teal", glyph: "rounded-full border-2 border-teal" },
  approved: { label: "Approved", pill: "border-teal/40 text-ink", glyph: "rounded-full bg-teal" },
  rejected: { label: "Rejected", pill: "border-red/50 text-red", glyph: "rounded-sm bg-red" },
  neutral: { label: "", pill: "border-line-2 text-ink-2", glyph: "rounded-full bg-ink-3" },
};

export function StatusGlyph({ status = "neutral", className }) {
  const s = STATUS[status] || STATUS.neutral;
  return <i aria-hidden="true" className={cn("inline-block h-[9px] w-[9px] flex-none", s.glyph, className)} />;
}

export function StatusPill({ status = "neutral", children, className, ...props }) {
  const s = STATUS[status] || STATUS.neutral;
  return (
    <span
      className={cn("inline-flex h-6 items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 text-xs", s.pill, className)}
      {...props}
    >
      <StatusGlyph status={status} />
      {children ?? s.label}
    </span>
  );
}
