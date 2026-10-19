import { useState } from "react";
import { AlertTriangle, Check, CircleX, Info, Sparkles } from "lucide-react";
import { Button } from "../../components/ui/button";
import { cn } from "../../lib/utils";

const CHECK = {
  ok: { Icon: Check, className: "text-teal" },
  warn: { Icon: AlertTriangle, className: "text-amber" },
  fail: { Icon: CircleX, className: "text-red" },
  info: { Icon: Info, className: "text-ink-3" },
};

const STATUS = {
  confirmed: { text: "Done", className: "border-teal/40 text-teal" },
  cancelled: { text: "Cancelled", className: "border-line-2 text-ink-3" },
  failed: { text: "Refused by the app", className: "border-red/40 text-red" },
  expired: { text: "Expired", className: "border-line-2 text-ink-3" },
};

/**
 * Something the assistant prepared. Nothing happens until the person presses
 * Confirm; the app then carries it out with their own permissions.
 */
export function DraftCard({ draft, onDecide }) {
  const [busy, setBusy] = useState(null);
  const pending = draft.status === "pending";
  const decide = async (decision) => {
    setBusy(decision);
    await onDecide(draft, decision);
    setBusy(null);
  };
  return (
    <section aria-label={`Prepared: ${draft.title}`} className={cn("grid gap-2 rounded-lg border bg-panel p-3", pending ? "border-teal/50" : "border-line")}>
      <p className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 font-mono text-[10.5px] uppercase tracking-[0.1em] text-teal">
          <Sparkles className="h-3.5 w-3.5" aria-hidden /> Prepared for you
        </span>
        {!pending && <span className={cn("rounded-full border px-2 text-[11px]", STATUS[draft.status]?.className)}>{STATUS[draft.status]?.text || draft.status}</span>}
      </p>
      <p className="text-[13.5px] font-semibold leading-snug text-ink">{draft.title}</p>
      <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-0.5 text-[12.5px]">
        {draft.details.map((d) => (
          <div key={d.label} className="contents">
            <dt className="text-ink-3">{d.label}</dt>
            <dd className="min-w-0 break-words text-ink">{d.value}</dd>
          </div>
        ))}
      </dl>
      {draft.checks?.length > 0 && (
        <ul className="grid gap-1 border-t border-line pt-2 text-[12px]">
          {draft.checks.map((c, i) => {
            const { Icon, className } = CHECK[c.tone] || CHECK.info;
            return (
              <li key={i} className="flex items-start gap-1.5">
                <Icon className={cn("mt-0.5 h-3.5 w-3.5 flex-none", className)} aria-hidden />
                <span className="text-ink-2">{c.text}</span>
              </li>
            );
          })}
        </ul>
      )}
      {draft.status === "failed" && draft.error && <p className="text-[12px] text-red">{draft.error}</p>}
      {pending && (
        <div className="flex gap-2 pt-1">
          <Button size="sm" onClick={() => decide("confirm")} disabled={Boolean(busy)}>
            <Check aria-hidden /> {busy === "confirm" ? "Working…" : "Confirm"}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => decide("cancel")} disabled={Boolean(busy)}>
            Cancel
          </Button>
        </div>
      )}
    </section>
  );
}
