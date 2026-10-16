import { cn } from "../../lib/utils";

const EDGE = { teal: "border-teal", amber: "border-amber", red: "border-red", neutral: "border-ink-3" };

// Row of figures with a coloured left edge: the number in mono, a short label.
export function FigureStrip({ figures, loading }) {
  return (
    <dl className="grid grid-cols-2 gap-2 lg:grid-cols-4">
      {figures.map((f) => (
        <div key={f.label} className={cn("flex flex-col-reverse rounded-r-md border-l-2 bg-panel px-3 py-2.5", EDGE[f.tone || "teal"])}>
          <dt className="text-xs text-ink-2">{f.label}</dt>
          <dd className={cn("figure text-xl font-medium leading-tight", loading && "w-12 animate-pulse rounded bg-sunk text-transparent")}>
            {loading ? "00" : f.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}
