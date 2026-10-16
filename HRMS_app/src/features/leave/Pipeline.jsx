import { useState } from "react";
import { cn } from "../../lib/utils";
import { countWorkingDays } from "../../lib/dates";
import { formatRange, fullName } from "./leaveUtils";

const SHOW = 12;

const daysUntil = (date) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const t = new Date();
  t.setHours(0, 0, 0, 0);
  return Math.round((d - t) / 86400000);
};

// Small flags on a card: overlap (from the Today queue), starting soon, open proposal.
const cardFlags = (request, stage, queueFlags) => {
  const flags = [...(queueFlags || []).filter((f) => f.tone === "red").map((f) => ({ tone: "red", label: f.label.replace(/^Overlap .*/, "overlap") }))];
  const n = daysUntil(request.startDate);
  if ((stage === "yours" || stage === "others") && n >= 0 && n <= 7) flags.push({ tone: "amber", label: n === 0 ? "today" : `in ${n} d` });
  if (stage === "employee") flags.push({ tone: "teal", label: `proposed ${formatRange(request.counterProposal.startDate, request.counterProposal.endDate)}` });
  return flags;
};

const FLAG = { red: "text-red", amber: "text-amber", teal: "text-teal" };

function Card({ request, stage, selected, onSelect, queueFlags }) {
  const days = countWorkingDays(request.startDate, request.endDate);
  const flags = cardFlags(request, stage, queueFlags);
  return (
    <button
      type="button"
      onClick={() => onSelect(request._id)}
      aria-pressed={selected}
      data-request={request._id}
      className={cn(
        "grid w-full gap-0.5 rounded-lg border bg-panel p-2 text-left transition-colors",
        selected ? "border-teal shadow-[0_0_0_2px_rgb(var(--teal)/0.35)]" : "border-line hover:border-line-2"
      )}
    >
      <b className="truncate text-[12.5px] font-semibold">{fullName(request.employeeId)}</b>
      <span className="figure text-[10.5px] text-ink-2">
        {formatRange(request.startDate, request.endDate)} · {days} d
      </span>
      <span className="flex items-center justify-between gap-1">
        <span className="truncate text-[11px] text-ink-3">{request.reason.replace(" Leave", "")}</span>
        {flags.map((f) => (
          <span key={f.label} className={cn("flex-none rounded border border-current px-1 text-[10px]", FLAG[f.tone])}>
            {f.label}
          </span>
        ))}
      </span>
    </button>
  );
}

function Column({ column, items, selectedId, onSelect, queueFlags }) {
  const [all, setAll] = useState(false);
  const shown = all ? items : items.slice(0, SHOW);
  return (
    <section
      aria-label={`${column.label}: ${items.length}`}
      className={cn("flex min-w-[200px] flex-col gap-1.5 rounded-xl border p-2", column.highlight ? "border-teal/40 bg-teal/10" : "border-line bg-sunk")}
    >
      <h3 className="flex items-center justify-between px-0.5 pb-1 text-xs font-semibold">
        <span>{column.label}</span>
        <span className={cn("figure", column.highlight ? "text-teal" : "text-ink-3")}>{items.length}</span>
      </h3>
      {items.length === 0 && <p className="px-1 py-3 text-center text-[11px] text-ink-3">Nothing here</p>}
      {shown.map((r) => (
        <Card key={r._id} request={r} stage={column.key} selected={r._id === selectedId} onSelect={onSelect} queueFlags={queueFlags[r._id]} />
      ))}
      {items.length > SHOW && (
        <button type="button" onClick={() => setAll((v) => !v)} className="h-8 rounded-md text-xs text-teal hover:bg-panel">
          {all ? "Show fewer" : `Show ${items.length - SHOW} more`}
        </button>
      )}
    </section>
  );
}

// Requests by stage, as columns. `groups` comes from buildPipeline().
export function Pipeline({ columns, groups, selectedId, onSelect, queueFlags = {} }) {
  return (
    <div className="grid auto-cols-[minmax(200px,1fr)] grid-flow-col gap-2 overflow-x-auto pb-1">
      {columns.map((c) => (
        <Column key={c.key} column={c} items={groups[c.key]} selectedId={selectedId} onSelect={onSelect} queueFlags={queueFlags} />
      ))}
    </div>
  );
}
