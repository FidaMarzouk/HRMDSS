import { Link } from "react-router-dom";
import { CheckCircle2 } from "lucide-react";
import { Button } from "../../components/ui/button";
import { cn } from "../../lib/utils";

const EDGE = { red: "border-t-red", amber: "border-t-amber", teal: "border-t-teal" };
const KEY = { red: "text-red", amber: "text-amber", teal: "text-teal" };

/**
 * Ranked signals: a finding, the records behind it and one action.
 * They describe departments and periods, never scores for individuals.
 */
export function Signals({ signals, loading }) {
  if (loading) {
    return (
      <div className="grid gap-3 md:grid-cols-3" aria-busy="true">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-36 animate-pulse rounded-xl border border-line bg-panel" />
        ))}
      </div>
    );
  }
  if (!signals.length) {
    return (
      <p className="flex items-center gap-2 rounded-xl border border-line bg-panel px-4 py-3 text-[13px] text-ink-2">
        <CheckCircle2 className="h-4 w-4 text-teal" aria-hidden />
        Nothing needs attention in this period: coverage, punctuality, overtime, time records and leave decisions are within their limits.
      </p>
    );
  }
  return (
    <ol className="grid gap-3 md:grid-cols-2 xl:grid-cols-3" aria-label="Signals, most urgent first">
      {signals.map((s, i) => (
        <li key={s.id} className={cn("flex flex-col gap-2 rounded-xl border border-t-[3px] border-line bg-panel p-4", EDGE[s.tone])}>
          <p className={cn("font-mono text-[11px] uppercase tracking-[0.12em]", KEY[s.tone])}>
            {s.label} {i + 1}/{signals.length}
          </p>
          <p className="text-[14px] font-semibold leading-snug text-ink">{s.title}</p>
          <p className="text-[12.5px] leading-relaxed text-ink-2">{s.evidence}</p>
          {s.action && (
            <div className="mt-auto pt-1">
              <Button asChild size="sm" variant={i === 0 ? "primary" : "secondary"}>
                {s.action.to.startsWith("#") ? <a href={s.action.to}>{s.action.label}</a> : <Link to={s.action.to}>{s.action.label}</Link>}
              </Button>
            </div>
          )}
        </li>
      ))}
    </ol>
  );
}
