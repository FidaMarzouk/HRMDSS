import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Check, ChevronRight } from "lucide-react";
import { Avatar } from "../../components/ui/avatar";
import { cn } from "../../lib/utils";
import { pathFor } from "../../config/navigation";
import { approveItem, usePendingDecisions } from "./decisions";
import { describeWhen } from "./describe";

const FLAG_TONE = { red: "text-red", amber: "text-amber" };

function QueueRow({ item, pending }) {
  const navigate = useNavigate();
  return (
    <li className={cn("flex items-center gap-3 border-t border-line py-2.5 transition-opacity", pending && "opacity-50")}>
      <Avatar user={item.person} size="sm" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13.5px]">{item.title}</p>
        <p className="figure truncate text-[11px] uppercase tracking-[0.04em] text-ink-3">
          {pending ? (
            <span className="text-teal">Approved · undo available</span>
          ) : (
            <>
              {describeWhen(item)}
              {item.flags.map((f) => (
                <span key={f.label} className={FLAG_TONE[f.tone]} title={f.detail}>
                  {" · "}
                  {f.label}
                </span>
              ))}
            </>
          )}
        </p>
      </div>
      <button
        type="button"
        disabled={pending}
        onClick={() => approveItem(item)}
        aria-label={`Approve: ${item.title}`}
        title="Approve"
        className="grid h-9 w-9 flex-none place-items-center rounded-md border border-teal/40 bg-teal/10 text-teal hover:bg-teal/20 disabled:opacity-50"
      >
        <Check className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={() => navigate(pathFor(item.kind === "leave" ? "leave" : "calendar"))}
        aria-label={`Open: ${item.title}`}
        title="Open"
        className="grid h-9 w-9 flex-none place-items-center rounded-md border border-line-2 text-ink-2 hover:bg-sunk hover:text-ink"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </li>
  );
}

const FIRST = 8;

export function DecisionQueue({ items, loading }) {
  const pending = usePendingDecisions();
  const [showAll, setShowAll] = useState(false);
  if (loading) {
    return (
      <ul aria-busy="true" className="space-y-2 pt-2">
        {[0, 1, 2].map((i) => (
          <li key={i} className="h-11 animate-pulse rounded-md bg-sunk" />
        ))}
      </ul>
    );
  }
  if (!items.length) {
    return (
      <div className="mt-2 rounded-lg border border-dashed border-line-2 p-5 text-center">
        <p className="text-sm font-medium">Nothing needs your decision</p>
        <p className="mt-1 text-xs text-ink-2">New leave requests and bookings appear here as they arrive, soonest first.</p>
      </div>
    );
  }
  const shown = showAll ? items : items.slice(0, FIRST);
  return (
    <>
      <ul>
        {shown.map((item) => (
          <QueueRow key={`${item.kind}:${item.id}`} item={item} pending={pending.has(item.id)} />
        ))}
      </ul>
      {items.length > FIRST && (
        <button
          type="button"
          onClick={() => setShowAll((v) => !v)}
          className="mt-1 h-10 w-full rounded-md border-t border-line text-sm text-teal hover:bg-sunk"
        >
          {showAll ? "Show the first 8" : `Show all ${items.length}`}
        </button>
      )}
    </>
  );
}
