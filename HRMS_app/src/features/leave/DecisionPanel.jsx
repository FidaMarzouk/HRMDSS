import { forwardRef, useEffect, useImperativeHandle, useState } from "react";
import { Check, X } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Field, Input, Textarea } from "../../components/ui/field";
import { Kbd } from "../../components/ui/kbd";
import { Steps } from "../../components/ui/steps";
import { StatusPill } from "../../components/ui/status-pill";
import { Avatar } from "../../components/ui/avatar";
import { formatDay, toDayKey } from "../../lib/dates";
import { CoverageGrid } from "./CoverageGrid";
import { PolicyChecks } from "./PolicyChecks";
import { answerProposal, decideLeave, proposeDates, useLeaveContext } from "./leaveApi";
import { formatRange, fullName, statusKind } from "./leaveUtils";

const daysFromToday = (date) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const t = new Date();
  t.setHours(0, 0, 0, 0);
  return Math.round((d - t) / 86400000);
};

const startsLabel = (date) => {
  const n = daysFromToday(date);
  if (n > 1) return `starts in ${n} days`;
  if (n === 1) return "starts tomorrow";
  if (n === 0) return "starts today";
  return `started ${-n} day${n === -1 ? "" : "s"} ago`;
};

const HISTORY_LABEL = {
  submitted: "Submitted",
  approved: "Approved",
  rejected: "Rejected",
  undone: "Decision undone",
  counter_proposed: "New dates proposed",
  proposal_accepted: "Proposal accepted",
  proposal_declined: "Proposal declined",
  proposal_withdrawn: "Proposal withdrawn",
};

function ProposalBox({ request, canRespond }) {
  const [busy, setBusy] = useState(false);
  const p = request.counterProposal;
  if (!p?.status) return null;
  const answer = async (accept) => {
    setBusy(true);
    await answerProposal({ request, accept });
    setBusy(false);
  };
  const text = {
    open: `${fullName(p.by)} proposed ${formatRange(p.startDate, p.endDate)}${canRespond ? "" : `. Waiting on ${request.employeeId?.firstName || "the employee"}.`}`,
    accepted: `${formatRange(p.startDate, p.endDate)} proposed by ${fullName(p.by)} was accepted`,
    declined: `${formatRange(p.startDate, p.endDate)} proposed by ${fullName(p.by)} was declined`,
    withdrawn: `The proposal for ${formatRange(p.startDate, p.endDate)} was withdrawn`,
  }[p.status];
  return (
    <div className={p.status === "open" ? "rounded-lg border border-teal/40 bg-teal/10 p-3" : "rounded-lg border border-line p-3"}>
      <p className="text-[13px]">{text}</p>
      {p.note && <p className="mt-1 text-xs text-ink-2">“{p.note}”</p>}
      {canRespond && p.status === "open" && (
        <div className="mt-3 flex flex-wrap gap-2">
          <Button size="sm" onClick={() => answer(true)} disabled={busy}>
            <Check /> Accept new dates
          </Button>
          <Button size="sm" variant="secondary" onClick={() => answer(false)} disabled={busy}>
            Keep my dates
          </Button>
        </div>
      )}
    </div>
  );
}

/**
 * Everything needed to decide one request: approval track, team coverage,
 * policy checks, suggested dates and the actions. The page drives keyboard
 * triage through the ref: approve(), propose(), reject().
 */
export const DecisionPanel = forwardRef(function DecisionPanel({ requestId, onDecided }, ref) {
  const { data, isLoading, isError } = useLeaveContext(requestId);
  const [mode, setMode] = useState("idle"); // idle | propose | reject
  const [note, setNote] = useState("");
  const [dates, setDates] = useState({ start: "", end: "" });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setMode("idle");
    setNote("");
  }, [requestId]);

  const request = data?.request;
  const canReview = Boolean(data?.canReview);

  const openPropose = () => {
    if (!canReview) return;
    const s = data.suggestion;
    setDates({ start: toDayKey(s?.startDate || request.startDate), end: toDayKey(s?.endDate || request.endDate) });
    setMode("propose");
  };

  const decide = async (action) => {
    if (!canReview || busy) return;
    setBusy(true);
    const ok = await decideLeave({ request, reviewPath: data.reviewPath, action, note: note.trim() || undefined });
    setBusy(false);
    if (ok) onDecided?.();
  };

  const submitProposal = async (e) => {
    e.preventDefault();
    setBusy(true);
    const ok = await proposeDates({ request, startDate: dates.start, endDate: dates.end, note: note.trim() || undefined });
    setBusy(false);
    if (ok) {
      setMode("idle");
      onDecided?.();
    }
  };

  useImperativeHandle(ref, () => ({
    approve: () => decide("approve"),
    propose: openPropose,
    reject: () => (mode === "reject" ? decide("reject") : canReview && setMode("reject")),
  }));

  if (!requestId) {
    return (
      <div className="grid h-full min-h-[240px] place-items-center rounded-xl border border-dashed border-line-2 p-6 text-center">
        <div>
          <p className="text-sm font-medium">Select a request</p>
          <p className="mt-1 text-xs text-ink-2">Its team coverage, policy checks and approval track appear here.</p>
        </div>
      </div>
    );
  }
  if (isLoading) return <div aria-busy="true" className="h-[420px] animate-pulse rounded-xl bg-sunk" />;
  if (isError || !data) return <p className="rounded-xl border border-red/30 bg-red/10 p-4 text-sm text-red">This request could not be loaded.</p>;

  const { coverage, department } = data;
  const worst = coverage.overLimit[0];
  const worstIndex = worst ? coverage.days.indexOf(worst) : -1;
  const maxAway = coverage.maxAwayInRequest ?? Math.max(0, ...coverage.away);

  return (
    <section aria-label={`Leave request: ${fullName(request.employeeId)}`} className="grid gap-4 rounded-xl border border-line bg-panel p-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <Avatar user={request.employeeId} />
          <div className="min-w-0">
            <h2 className="truncate text-lg font-semibold leading-tight">{fullName(request.employeeId)}</h2>
            <p className="truncate text-[13px] text-ink-2">
              {request.reason}
              {department && ` · ${department.name}`}
              {request.managerId && ` · reviewer ${fullName(request.managerId)}`}
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className="figure text-[15px]">{formatRange(request.startDate, request.endDate)}</p>
          <p className="text-xs text-ink-3">
            {request.workingDays} working day{request.workingDays === 1 ? "" : "s"} · {startsLabel(request.startDate)}
          </p>
        </div>
      </header>

      <div className="flex flex-wrap items-center gap-2">
        <StatusPill status={statusKind(request.status)}>{request.status}</StatusPill>
        {data.canUndo && <span className="text-xs text-ink-3">Your decision can still be undone from the notification.</span>}
      </div>

      <Steps steps={data.steps} />

      <div className="grid gap-2">
        <div className="flex flex-wrap items-baseline justify-between gap-2 text-xs">
          <span className="label-key">Team coverage</span>
          {worst ? (
            <span className="figure text-red">
              {formatDay(worst, { day: "numeric", month: "short" })}: {coverage.away[worstIndex]} of {coverage.teamSize} away · limit {coverage.limit}
            </span>
          ) : (
            <span className="figure text-ink-3">
              at most {maxAway} of {coverage.teamSize} away · limit {coverage.limit}
            </span>
          )}
        </div>
        <CoverageGrid coverage={coverage} />
      </div>

      <PolicyChecks checks={data.checks} suggestion={data.suggestion} formatRange={formatRange} />

      <ProposalBox request={request} canRespond={data.canRespond} />

      {canReview && mode === "propose" && (
        <form onSubmit={submitProposal} className="grid gap-3 rounded-lg border border-line p-3">
          <p className="text-sm font-medium">Propose other dates</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="From">
              <Input type="date" value={dates.start} onChange={(e) => setDates((d) => ({ ...d, start: e.target.value }))} required />
            </Field>
            <Field label="To">
              <Input type="date" value={dates.end} min={dates.start} onChange={(e) => setDates((d) => ({ ...d, end: e.target.value }))} required />
            </Field>
          </div>
          <Field label="Note to the employee (optional)">
            <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} placeholder="e.g. Two teammates are already off on the 25th." />
          </Field>
          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={busy}>Send proposal</Button>
            <Button variant="ghost" onClick={() => setMode("idle")}>Cancel</Button>
          </div>
        </form>
      )}

      {canReview && mode !== "propose" && (
        <div className="grid gap-3">
          <Field label={mode === "reject" ? "Reason for the employee (recommended)" : "Note to the employee (optional)"}>
            <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} autoFocus={mode === "reject"} />
          </Field>
          <div className="flex flex-wrap items-center gap-2">
            {mode === "reject" ? (
              <>
                <Button variant="danger" onClick={() => decide("reject")} disabled={busy}>
                  <X /> Reject request
                </Button>
                <Button variant="ghost" onClick={() => setMode("idle")}>Cancel</Button>
              </>
            ) : (
              <>
                <Button onClick={() => decide("approve")} disabled={busy}>
                  <Check /> Approve
                </Button>
                <Button variant="secondary" onClick={openPropose} disabled={busy}>
                  {data.suggestion ? `Propose ${formatRange(data.suggestion.startDate, data.suggestion.endDate)}` : "Propose dates"}
                </Button>
                <Button variant="ghost" className="text-red hover:text-red" onClick={() => setMode("reject")} disabled={busy}>
                  Reject…
                </Button>
              </>
            )}
          </div>
          <p className="hidden flex-wrap gap-x-3 gap-y-1 text-[11px] text-ink-3 md:flex">
            <span><Kbd>A</Kbd> approve</span>
            <span><Kbd>C</Kbd> propose dates</span>
            <span><Kbd>R</Kbd> reject</span>
            <span><Kbd>J</Kbd> <Kbd>K</Kbd> next / previous</span>
          </p>
        </div>
      )}

      {request.history?.length > 0 && (
        <details className="text-xs text-ink-2">
          <summary className="cursor-pointer select-none text-ink-3">History ({request.history.length})</summary>
          <ol className="mt-2 grid gap-1">
            {request.history.map((h, i) => (
              <li key={i} className="grid grid-cols-[110px_1fr] gap-2">
                <span className="figure text-ink-3">{new Date(h.at).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
                <span>
                  {HISTORY_LABEL[h.action] || h.action}
                  {h.by && ` · ${fullName(h.by)}`}
                  {h.startDate && ` · ${formatRange(h.startDate, h.endDate)}`}
                  {h.note && ` · “${h.note}”`}
                </span>
              </li>
            ))}
          </ol>
        </details>
      )}
    </section>
  );
});
