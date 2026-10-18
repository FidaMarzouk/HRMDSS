import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft, ChevronRight, Wrench } from "lucide-react";
import { Ribbon, RibbonAxis, RibbonLegend } from "../../components/marks/Ribbon";
import { Avatar } from "../../components/ui/avatar";
import { Button } from "../../components/ui/button";
import { Input, Textarea } from "../../components/ui/field";
import { Switch } from "../../components/ui/switch";
import { StatusPill } from "../../components/ui/status-pill";
import { formatDay, toDayKey } from "../../lib/dates";
import { cn } from "../../lib/utils";
import { pathFor } from "../../config/navigation";
import { formatClock } from "./sessions";
import { CorrectionDialog } from "./CorrectionDialog";
import { decideCorrection, useCorrections, useDay, useMine } from "./timeApi";

const TONE = { red: "text-red border-red/40", amber: "text-amber border-amber/50", teal: "text-teal border-teal/40" };
const isPastDay = (date) => toDayKey(date) < toDayKey(new Date());
const nowMinutes = () => {
  const d = new Date();
  return d.getHours() * 60 + d.getMinutes();
};

function Flags({ anomalies }) {
  return (
    <span className="flex flex-wrap gap-1">
      {anomalies.map((a) => (
        <span key={a.kind} className={cn("rounded border px-1 text-[10px]", TONE[a.tone])}>{a.label}</span>
      ))}
    </span>
  );
}

const timesOf = (sessions) => {
  const first = sessions[0];
  const last = sessions[sessions.length - 1];
  const hours = sessions.reduce((n, s) => n + (s.productionHours || 0), 0);
  return { in: first?.checkIn, out: last?.checkOut, open: last && !last.checkOut, hours };
};

function RibbonRow({ person, date, children, showName = true, linkPeople }) {
  const t = timesOf(person.sessions);
  const missing = person.anomalies.some((a) => a.kind === "missing_punch_out");
  const late = person.anomalies.some((a) => a.kind === "late");
  const today = !isPastDay(date);
  const name = `${person.firstName || ""} ${person.lastName || ""}`.trim();
  const status = person.leave ? `on leave (${person.leave})` : person.mission ? "on mission" : person.absent ? "absent" : person.sessions.length ? `in ${formatClock(t.in)}, out ${t.out ? formatClock(t.out) : "not recorded"}` : "no punches";
  return (
    <li className="grid items-center gap-x-3 gap-y-1 border-t border-line py-2 text-[13px] md:grid-cols-[180px_minmax(0,1fr)_52px_52px_44px_minmax(0,160px)]">
      {showName ? (
        <span className="flex min-w-0 items-center gap-2">
          <Avatar user={person} size="sm" />
          {linkPeople ? (
            <Link to={`${pathFor("people")}?person=${person.id}`} className="truncate hover:underline">{name}</Link>
          ) : (
            <span className="truncate">{name}</span>
          )}
        </span>
      ) : (
        <span className="figure text-ink-2">{formatDay(date, { weekday: "short", day: "numeric", month: "short" })}</span>
      )}
      <Ribbon
        sessions={person.sessions}
        late={late}
        missing={missing}
        leave={person.leave}
        absent={person.absent}
        mission={person.mission}
        nowMinutes={today ? nowMinutes() : undefined}
        label={`${showName ? name : formatDay(date)}: ${status}`}
      />
      <span className={cn("figure text-xs", late ? "text-amber" : "")}>{t.in ? formatClock(t.in) : "—"}</span>
      <span className={cn("figure text-xs", missing ? "text-red" : "")}>{t.out ? formatClock(t.out) : t.open ? (missing ? "— —" : "…") : "—"}</span>
      <span className="figure text-xs text-ink-3">{t.hours ? t.hours.toFixed(1) : ""}</span>
      <span className="flex min-w-0 items-center justify-end gap-1.5">
        <Flags anomalies={person.leave ? [] : person.anomalies} />
        {person.leave && <span className="text-[11px] text-ink-3">{person.leave.replace(" Leave", "")} leave</span>}
        {person.pendingCorrection && <span className="text-[10px] text-teal">correction pending</span>}
        {children}
      </span>
    </li>
  );
}

function RibbonHeader({ first = "Person" }) {
  return (
    <div className="hidden gap-x-3 font-mono text-[10px] uppercase tracking-[0.1em] text-ink-3 md:grid md:grid-cols-[180px_minmax(0,1fr)_52px_52px_44px_minmax(0,160px)]">
      <span>{first}</span>
      <RibbonAxis />
      <span>In</span>
      <span>Out</span>
      <span>Hrs</span>
      <span />
    </div>
  );
}

const shiftDay = (key, delta) => {
  const d = new Date(`${key}T12:00:00Z`);
  do d.setUTCDate(d.getUTCDate() + delta);
  while (d.getUTCDay() === 0 || d.getUTCDay() === 6);
  return d.toISOString().slice(0, 10);
};

/** Reviewer view: everyone in scope on one day, with an exceptions-only switch. */
export function TeamDay({ linkPeople }) {
  const [date, setDate] = useState(() => toDayKey(new Date()));
  const [onlyExceptions, setOnlyExceptions] = useState(false);
  const { data, isLoading, isError } = useDay(date);
  const people = useMemo(() => data?.people || [], [data]);
  const shown = onlyExceptions ? people.filter((p) => p.anomalies.length || p.pendingCorrection) : people;
  const counts = {
    in: people.filter((p) => p.sessions.length).length,
    exceptions: people.filter((p) => p.anomalies.length).length,
  };
  const today = toDayKey(new Date());

  return (
    <section className="grid gap-3 rounded-xl border border-line bg-panel p-4" aria-label="Day ribbons">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon-sm" aria-label="Previous working day" onClick={() => setDate((d) => shiftDay(d, -1))}><ChevronLeft /></Button>
          <Input type="date" value={date} max={today} onChange={(e) => e.target.value && setDate(e.target.value)} aria-label="Day" className="h-9 w-[150px]" />
          <Button variant="ghost" size="icon-sm" aria-label="Next working day" disabled={date >= today} onClick={() => setDate((d) => shiftDay(d, 1))}><ChevronRight /></Button>
          {date !== today && <Button variant="link" size="sm" onClick={() => setDate(today)}>Today</Button>}
        </div>
        <div className="flex items-center gap-3 text-xs text-ink-2">
          <span className="figure">{counts.in} punched · {counts.exceptions} with exceptions</span>
          <label className="flex items-center gap-2">
            Exceptions only
            <Switch checked={onlyExceptions} onChange={setOnlyExceptions} label="Show exceptions only" />
          </label>
        </div>
      </div>
      <RibbonHeader />
      {isError && <p role="alert" className="text-sm text-red">This day could not be loaded.</p>}
      {isLoading ? (
        <div aria-busy="true" className="h-40 animate-pulse rounded bg-sunk" />
      ) : (
        <ul>
          {shown.length === 0 && <li className="border-t border-line py-8 text-center text-sm text-ink-2">{onlyExceptions ? "No exceptions on this day." : "No one to show."}</li>}
          {shown.map((p) => <RibbonRow key={p.id} person={p} date={data.date} linkPeople={linkPeople} />)}
        </ul>
      )}
      <RibbonLegend />
    </section>
  );
}

/** The user's own last working days, with "Fix…" to request a correction. */
export function MyDays() {
  const { data, isLoading } = useMine();
  const [fixing, setFixing] = useState(null);
  const days = data?.days || [];
  return (
    <section className="grid gap-3 rounded-xl border border-line bg-panel p-4" aria-label="My last working days">
      <div className="flex items-baseline justify-between">
        <h2 className="text-sm font-semibold">My last 10 working days</h2>
        <span className="text-xs text-ink-3">Something wrong? Use Fix to ask for a correction.</span>
      </div>
      <RibbonHeader first="Day" />
      {isLoading ? (
        <div aria-busy="true" className="h-40 animate-pulse rounded bg-sunk" />
      ) : (
        <ul>
          {days.map((d) => {
            const pending = d.corrections.some((c) => c.status === "pending");
            const canFix = !d.leave && !pending && (d.sessions.length > 0 || d.absent || isPastDay(d.date));
            return (
              <RibbonRow key={d.date} person={{ ...d, id: d.date, pendingCorrection: pending ? "pending" : null }} date={d.date} showName={false}>
                {canFix && (
                  <Button variant={d.anomalies.length ? "secondary" : "ghost"} size="sm" className="h-7 px-2" onClick={() => setFixing(d)}>
                    <Wrench /> Fix
                  </Button>
                )}
              </RibbonRow>
            );
          })}
        </ul>
      )}
      <RibbonLegend />
      <CorrectionDialog day={fixing} open={Boolean(fixing)} onClose={() => setFixing(null)} />
    </section>
  );
}

const STATUS_PILL = { pending: "pending", approved: "approved", rejected: "rejected" };

function CorrectionRow({ c, review }) {
  const [rejecting, setRejecting] = useState(false);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const decide = async (approve) => {
    setBusy(true);
    await decideCorrection(c.id, approve, note.trim() || undefined);
    setBusy(false);
  };
  const proposed = [c.checkIn && `in ${formatClock(c.checkIn)}`, c.checkOut && `out ${formatClock(c.checkOut)}`].filter(Boolean).join(", ");
  const current = c.current ? `was ${c.current.checkIn ? formatClock(c.current.checkIn) : "—"}–${c.current.checkOut ? formatClock(c.current.checkOut) : "open"}` : "";
  return (
    <li className="grid gap-1.5 border-t border-line py-2.5">
      <div className="flex flex-wrap items-center gap-2">
        {review && c.person && <Avatar user={c.person} size="sm" />}
        <span className="min-w-0 flex-1 text-[13px]">
          {review && c.person && <b className="font-semibold">{c.person.firstName} {c.person.lastName} · </b>}
          {c.label} · <span className="figure text-ink-2">{formatDay(c.date, { weekday: "short", day: "numeric", month: "short" })}</span>
        </span>
        <StatusPill status={STATUS_PILL[c.status]}>{c.status}</StatusPill>
      </div>
      <p className="figure text-[11px] text-ink-3">{[proposed, current].filter(Boolean).join(" · ")}</p>
      <p className="text-xs text-ink-2">“{c.reason}”</p>
      {c.note && <p className="text-xs text-ink-3">Reviewer: “{c.note}” {c.decidedBy ? `· ${c.decidedBy}` : ""}</p>}
      {review && c.status === "pending" && (
        <div className="grid gap-2">
          {rejecting && <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Reason for rejecting (sent to them)" aria-label="Reason for rejecting" />}
          <div className="flex flex-wrap gap-2">
            {rejecting ? (
              <>
                <Button size="sm" variant="danger" onClick={() => decide(false)} disabled={busy}>Reject</Button>
                <Button size="sm" variant="ghost" onClick={() => setRejecting(false)}>Cancel</Button>
              </>
            ) : (
              <>
                <Button size="sm" onClick={() => decide(true)} disabled={busy}>Approve and update</Button>
                <Button size="sm" variant="ghost" className="text-red hover:text-red" onClick={() => setRejecting(true)}>Reject…</Button>
              </>
            )}
          </div>
        </div>
      )}
    </li>
  );
}

/** Corrections waiting on the viewer (review) or the viewer's own (mine). */
export function CorrectionsPanel({ scope }) {
  const { data, isLoading } = useCorrections(scope);
  const rows = data?.corrections || [];
  const review = scope === "review";
  return (
    <section className="grid gap-1 rounded-xl border border-line bg-panel p-4" aria-label={review ? "Corrections to review" : "My corrections"}>
      <div className="flex items-baseline justify-between">
        <h2 className="text-sm font-semibold">{review ? "Corrections to review" : "My corrections"}</h2>
        <span className="figure text-xs text-ink-3">{rows.filter((r) => r.status === "pending").length} pending</span>
      </div>
      {isLoading ? (
        <div aria-busy="true" className="h-16 animate-pulse rounded bg-sunk" />
      ) : rows.length === 0 ? (
        <p className="py-3 text-[13px] text-ink-3">{review ? "Nothing to review. Requests from your team appear here." : "No corrections requested."}</p>
      ) : (
        <ul>{rows.slice(0, review ? 20 : 6).map((c) => <CorrectionRow key={c.id} c={c} review={review} />)}</ul>
      )}
    </section>
  );
}
