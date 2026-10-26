import { Link } from "react-router-dom";
import { CalendarDays, Clipboard, Clock, ExternalLink } from "lucide-react";
import { Button } from "../../components/ui/button";
import { cn } from "../../lib/utils";
import { usePendingDecisions } from "../today/decisions";
import { runAction } from "./inboxApi";

const ICON = { leave: Clipboard, event: CalendarDays, correction: Clock };
const FOR_YOU = new Set(["Your decision", "Invitation", "New dates proposed"]);

/**
 * A leave request, event or time correction with its live status and the
 * actions open to the viewer. Used in the inbox and as a card in chat.
 */
export function RequestCard({ card, className }) {
  const pending = usePendingDecisions();
  if (!card) return null;
  if (card.missing || card.hidden) {
    return <p className={cn("rounded-lg border border-dashed border-line-2 px-3 py-2 text-[12.5px] text-ink-3", className)}>{card.title}</p>;
  }
  const Icon = ICON[card.kind] || Clipboard;
  const yours = FOR_YOU.has(card.status);
  const approving = pending.has(card.id);
  return (
    <div className={cn("grid gap-1 rounded-lg border bg-panel px-3 py-2.5 text-left", yours ? "border-teal/50" : "border-line", className)}>
      <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11.5px]">
        <span className="flex items-center gap-1 text-ink-2">
          <Icon className="h-3.5 w-3.5" aria-hidden /> {card.label}
        </span>
        <span className={cn("font-mono text-[10.5px] uppercase tracking-[0.08em]", yours || approving ? "text-teal" : "text-ink-3")}>
          {approving ? "Approved · undo available" : card.status}
        </span>
      </p>
      <p className="text-[13.5px] font-medium text-ink">{card.title}</p>
      <p className="figure text-[12px] text-ink-2">{card.detail}</p>
      <div className="mt-1 flex flex-wrap items-center gap-1.5">
        {!approving &&
          card.actions?.map((a) => (
            <Button key={a.id} size="sm" variant={a.tone === "primary" ? "primary" : a.tone === "danger" ? "danger" : "secondary"} onClick={() => runAction(card, a)}>
              {a.label}
            </Button>
          ))}
        <Button asChild size="sm" variant="ghost">
          <Link to={card.open}>
            Open <ExternalLink aria-hidden />
          </Link>
        </Button>
      </div>
    </div>
  );
}
