import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Eye, MessageCircle, Pencil, RotateCcw, X } from "lucide-react";
import { Dialog } from "../../components/ui/dialog";
import { Button } from "../../components/ui/button";
import { Avatar } from "../../components/ui/avatar";
import { Input } from "../../components/ui/field";
import { SegmentedControl } from "../../components/ui/segmented-control";
import { StatusPill } from "../../components/ui/status-pill";
import { Menu } from "../../components/ui/menu";
import { formatDay } from "../../lib/dates";
import { cn } from "../../lib/utils";
import { pathFor } from "../../config/navigation";
import { formatRange, statusKind } from "../leave/leaveUtils";
import { formatClock } from "../time/sessions";
import { EmployeeForm } from "./EmployeeForm";
import { ArchiveDialog } from "./ArchiveDialog";
import { refreshPeople, restorePerson, revealSalary, saveSkills, usePerson, usePersonHistory } from "./peopleApi";
import { ACCESS_LABEL, fullName, presenceDot, tenure } from "./peopleUtils";

const PRESENCE_TEXT = { in: "In", late: "In, late", left: "Left for the day", leave: "On leave", mission: "On mission", out: "Not in yet", absent: "Absent" };
const PRESENCE_TONE = { in: "text-teal", late: "text-amber", absent: "text-red" };

function Row({ label, children }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] text-ink-3">{label}</dt>
      <dd className="text-[13px] [overflow-wrap:anywhere]">{children ?? <span className="text-ink-3">—</span>}</dd>
    </div>
  );
}

function LevelBar({ level, label }) {
  return (
    <span className="flex gap-[3px]" role="img" aria-label={label}>
      {[1, 2, 3, 4, 5].map((i) => (
        <i key={i} className={cn("block h-1.5 w-[13px] rounded-[1px]", i <= (level || 0) ? "bg-teal" : "bg-line-2")} />
      ))}
    </span>
  );
}

function SalaryRow({ personId, canReveal }) {
  const [salary, setSalary] = useState(null);
  useEffect(() => setSalary(null), [personId]);
  return (
    <Row label="Salary">
      {salary != null ? (
        <span className="figure">
          {Number(salary).toLocaleString("fr-TN")} DT <span className="text-[11px] text-ink-3">· viewing logged</span>
        </span>
      ) : (
        <span className="flex items-center gap-2">
          <span className="figure tracking-widest text-ink-3">•••• DT</span>
          {canReveal && (
            <button type="button" onClick={async () => setSalary(await revealSalary(personId))} className="inline-flex items-center gap-1 text-xs text-teal hover:underline">
              <Eye className="h-3 w-3" /> Reveal
            </button>
          )}
        </span>
      )}
    </Row>
  );
}

function Skills({ person, canEdit }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState([]);
  const [newSkill, setNewSkill] = useState("");
  const start = () => {
    setDraft(person.skills.map((s) => ({ name: s.name, level: s.level || 0 })));
    setEditing(true);
  };
  const save = async () => {
    const ok = await saveSkills(person.id, draft.map((s) => ({ name: s.name, level: s.level || undefined })));
    if (ok) setEditing(false);
  };

  if (editing) {
    return (
      <div className="grid gap-2">
        {draft.map((s, i) => (
          <div key={s.name} className="flex items-center gap-2">
            <span className="min-w-0 flex-1 truncate text-[13px]">{s.name}</span>
            <SegmentedControl
              size="sm"
              label={`${s.name} level`}
              value={s.level}
              onChange={(level) => setDraft((d) => d.map((x, j) => (j === i ? { ...x, level } : x)))}
              options={[0, 1, 2, 3, 4, 5].map((n) => ({ value: n, label: n === 0 ? "–" : String(n) }))}
            />
            <button type="button" aria-label={`Remove ${s.name}`} onClick={() => setDraft((d) => d.filter((_, j) => j !== i))} className="grid h-8 w-8 place-items-center rounded text-ink-3 hover:bg-sunk hover:text-red">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const name = newSkill.trim();
            if (name && !draft.some((s) => s.name.toLowerCase() === name.toLowerCase())) setDraft((d) => [...d, { name, level: 0 }]);
            setNewSkill("");
          }}
        >
          <Input value={newSkill} onChange={(e) => setNewSkill(e.target.value)} placeholder="Add a skill" aria-label="Add a skill" className="h-9" />
          <Button type="submit" variant="secondary" size="sm" className="h-9">Add</Button>
        </form>
        <div className="flex gap-2">
          <Button size="sm" onClick={save}>Save ratings</Button>
          <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>Cancel</Button>
        </div>
        <p className="text-[11px] text-ink-3">A level you set is recorded as validated by you.</p>
      </div>
    );
  }
  return (
    <div className="grid gap-2">
      {person.skills.length === 0 && <p className="text-[13px] text-ink-3">No skills recorded.</p>}
      {person.skills.map((s) => (
        <div key={s.name} className="flex items-center justify-between gap-2">
          <span className="min-w-0 truncate text-[13px]">
            {s.name}
            {s.validatedBy && <span className="ml-1.5 text-[11px] text-ink-3">✓ {s.validatedBy}</span>}
          </span>
          {s.level ? <LevelBar level={s.level} label={`level ${s.level} of 5`} /> : <span className="text-[11px] text-ink-3">not rated</span>}
        </div>
      ))}
      {canEdit && (
        <button type="button" onClick={start} className="justify-self-start text-xs text-teal hover:underline">
          Rate skills
        </button>
      )}
    </div>
  );
}

function Overview({ data }) {
  const { person, permissions, reports, leave } = data;
  const t = tenure(person.hireDate);
  const usedPct = leave.allowance ? Math.min(100, Math.max(0, ((leave.allowance - leave.remaining) / leave.allowance) * 100)) : 0;
  return (
    <div className="grid gap-5">
      <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
        <Row label="Work email">{person.email}</Row>
        <Row label="Phone"><span className="figure">{person.phone}</span></Row>
        <Row label="Hired">{person.hireDate ? `${formatDay(person.hireDate)}${t ? ` · ${t.label}` : ""}` : null}</Row>
        <Row label="Access"><span className={cn("font-mono text-[11px] uppercase tracking-[0.06em]", person.role === "manager" ? "text-teal" : "text-ink-2")}>{ACCESS_LABEL[person.role] || person.role}</span></Row>
        <Row label="Department">{person.department?.name}</Row>
        <Row label="Manager">{person.manager ? fullName(person.manager) : null}</Row>
        {"personalEmail" in person && <Row label="Personal email">{person.personalEmail}</Row>}
        {"birthdate" in person && <Row label="Date of birth">{person.birthdate ? formatDay(person.birthdate) : null}</Row>}
        {(permissions.canRevealSalary || permissions.canEdit) && <SalaryRow personId={person.id} canReveal={permissions.canRevealSalary} />}
      </dl>

      {leave.allowance != null && (
        <div className="grid gap-1">
          <div className="flex justify-between text-xs">
            <span className="text-ink-3">Annual leave</span>
            <span className="figure">{leave.remaining} of {leave.allowance} left</span>
          </div>
          <div className="h-1.5 rounded bg-sunk"><div className="h-full rounded bg-teal" style={{ width: `${usedPct}%` }} /></div>
        </div>
      )}

      <section className="grid gap-2">
        <h3 className="label-key">Skills</h3>
        <Skills person={person} canEdit={permissions.canEditSkills && person.status !== "archived"} />
      </section>

      {reports.length > 0 && (
        <section className="grid gap-2">
          <h3 className="label-key">Direct reports · {reports.length}</h3>
          <ul className="flex flex-wrap gap-1.5">
            {reports.map((r) => (
              <li key={r.id} title={`${fullName(r)}, ${r.position}`}>
                <Avatar user={r} size="sm" />
                <span className="sr-only">{fullName(r)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

const DAY_CELL = { Present: "bg-teal", Late: "bg-amber", Absent: "border border-dashed border-red bg-transparent" };

function Time({ attendance }) {
  const days = attendance.days;
  return (
    <div className="grid gap-4">
      <div className="grid grid-cols-3 gap-2 text-center">
        {[["Present", attendance.summary.present, "text-teal"], ["Late", attendance.summary.late, "text-amber"], ["Absent", attendance.summary.absent, "text-red"]].map(([label, n, cls]) => (
          <div key={label} className="rounded-lg border border-line py-2">
            <p className={cn("figure text-lg", cls)}>{n}</p>
            <p className="text-[11px] text-ink-3">{label} · 30 days</p>
          </div>
        ))}
      </div>
      {days.length > 0 && (
        <div className="flex h-5 gap-[2px]" role="img" aria-label={`Last ${days.length} recorded days: ${attendance.summary.present} present, ${attendance.summary.late} late, ${attendance.summary.absent} absent`}>
          {[...days].reverse().map((d) => (
            <i key={d.date} title={`${formatDay(d.date, { weekday: "short", day: "numeric", month: "short" })}: ${d.status}`} className={cn("block flex-1 rounded-[1px]", DAY_CELL[d.status] || "bg-line-2")} />
          ))}
        </div>
      )}
      <ul className="grid">
        {days.length === 0 && <li className="text-[13px] text-ink-3">No attendance in the last 30 days.</li>}
        {days.slice(0, 15).map((d) => (
          <li key={d.date} className="flex items-center gap-3 border-t border-line py-2 text-[13px]">
            <span className="figure w-24 text-ink-2">{formatDay(d.date, { weekday: "short", day: "numeric", month: "short" })}</span>
            <StatusPill status={d.status === "Present" ? "present" : d.status === "Late" ? "late" : "absent"}>
              {d.status}{d.lateBy ? ` +${d.lateBy}m` : ""}
            </StatusPill>
            <span className="figure ml-auto text-ink-3">{d.checkIn ? `${formatClock(d.checkIn)}–${d.checkOut ? formatClock(d.checkOut) : "…"}` : ""}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Leave({ leave }) {
  return (
    <ul className="grid">
      {leave.requests.length === 0 && <li className="text-[13px] text-ink-3">No leave requests.</li>}
      {leave.requests.map((r) => (
        <li key={r._id} className="flex flex-wrap items-center gap-2 border-t border-line py-2 text-[13px]">
          <span className="figure w-32">{formatRange(r.startDate, r.endDate)}</span>
          <span className="text-ink-2">{r.reason.replace(" Leave", "")}</span>
          <StatusPill status={statusKind(r.status)} className="ml-auto">{r.status}</StatusPill>
          <Link to={`${pathFor("leave")}?request=${r._id}`} className="text-xs text-teal hover:underline">Open</Link>
        </li>
      ))}
    </ul>
  );
}

function History({ personId }) {
  const { data, isLoading } = usePersonHistory(personId, true);
  if (isLoading) return <div className="h-24 animate-pulse rounded bg-sunk" />;
  const entries = data?.entries || [];
  return (
    <ol className="grid">
      {entries.length === 0 && <li className="text-[13px] text-ink-3">Nothing recorded yet. Edits, reveals, decisions and archiving appear here.</li>}
      {entries.map((e) => (
        <li key={e.id} className="grid gap-0.5 border-t border-line py-2">
          <span className="figure text-[11px] text-ink-3">
            {new Date(e.at).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })} · {e.actor}
          </span>
          <span className="text-[13px]">{e.summary}</span>
          {e.reason && <span className="text-xs text-ink-2">“{e.reason}”</span>}
          {e.changes.length > 0 && e.action !== "user.update" && (
            <span className="text-xs text-ink-3">{e.changes.map((c) => `${c.field}: ${c.from ?? "—"} → ${c.to ?? "—"}`).join(" · ")}</span>
          )}
        </li>
      ))}
    </ol>
  );
}

/**
 * Profile drawer for the People page. mode: "view" | "edit" | "create".
 * personId is null when creating.
 */
export function ProfileDrawer({ personId, mode = "view", departments, onClose, onModeChange }) {
  const navigate = useNavigate();
  const { data, isLoading, isError } = usePerson(mode === "create" ? null : personId);
  const [tab, setTab] = useState("overview");
  const [archiveOpen, setArchiveOpen] = useState(false);

  useEffect(() => setTab("overview"), [personId]);

  const open = Boolean(personId) || mode === "create";
  const person = data?.person;
  const permissions = data?.permissions || {};
  const presence = data?.presence?.status;

  const tabs = [
    { value: "overview", label: "Overview" },
    { value: "time", label: "Time" },
    { value: "leave", label: "Leave" },
    ...(permissions.canSeeHistory ? [{ value: "history", label: "History" }] : []),
  ];

  const menuItems = [
    ...(permissions.canMessage ? [{ label: "Message", onSelect: () => navigate(`${pathFor("chat")}?with=${person.id}`) }] : []),
    ...(permissions.canEdit && person?.status !== "archived" ? [{ label: "Edit details", onSelect: () => onModeChange("edit") }] : []),
    ...(permissions.canArchive ? [{ divider: true }, { label: "Archive…", danger: true, onSelect: () => setArchiveOpen(true) }] : []),
    ...(permissions.archiveBlocked ? [{ divider: true }, { label: `Archive: ${permissions.archiveBlocked}`, disabled: true }] : []),
  ];

  return (
    <>
      <Dialog open={open} onClose={onClose} side="right" hideClose title={undefined} labelledBy="profile-title">
        <div className="-mx-5 -my-4 grid">
          {mode === "create" ? (
            <div className="grid gap-4 p-5">
              <div className="flex items-center justify-between">
                <h2 id="profile-title" className="text-lg font-semibold">Add a person</h2>
                <button type="button" aria-label="Close" onClick={onClose} className="grid h-10 w-10 place-items-center rounded-md text-ink-3 hover:bg-sunk"><X className="h-4 w-4" /></button>
              </div>
              <EmployeeForm departments={departments} onCancel={onClose} onSaved={() => { refreshPeople(); onClose(); }} />
            </div>
          ) : isLoading ? (
            <div aria-busy="true" className="grid gap-3 p-5">
              <div className="h-16 animate-pulse rounded-lg bg-sunk" />
              <div className="h-64 animate-pulse rounded-lg bg-sunk" />
            </div>
          ) : isError || !person ? (
            <div className="p-5">
              <p className="text-sm text-red">This profile could not be loaded.</p>
              <Button variant="ghost" onClick={onClose} className="mt-2">Close</Button>
            </div>
          ) : (
            <>
              <header className="grid gap-3 border-b border-line bg-raise p-5">
                <div className="flex items-center justify-between">
                  <span className="label-key">{person.department?.name || "No department"}</span>
                  <button type="button" aria-label="Close" onClick={onClose} className="-mr-2 grid h-10 w-10 place-items-center rounded-md text-ink-3 hover:bg-sunk"><X className="h-4 w-4" /></button>
                </div>
                <div className="flex items-center gap-3">
                  <Avatar user={person} size="lg" presence={person.status === "archived" ? undefined : presenceDot(presence)} />
                  <div className="min-w-0">
                    <h2 id="profile-title" className="truncate text-lg font-semibold leading-tight">{fullName(person)}</h2>
                    <p className="truncate text-[13px] text-ink-2">{person.position}</p>
                    {person.status !== "archived" && (
                      <p className={cn("text-xs", PRESENCE_TONE[presence] || "text-ink-3")}>
                        ● {PRESENCE_TEXT[presence] || "—"}{data.presence.since && (presence === "in" || presence === "late") ? ` since ${formatClock(data.presence.since)}` : ""}
                      </p>
                    )}
                  </div>
                </div>
                {person.status === "archived" && (
                  <div className="rounded-md border border-line-2 bg-sunk px-3 py-2 text-xs text-ink-2">
                    Archived {person.archivedAt ? formatDay(person.archivedAt) : ""}{person.archivedBy ? ` by ${person.archivedBy}` : ""}
                    {person.archiveReason ? ` · “${person.archiveReason}”` : ""}
                  </div>
                )}
                {mode !== "edit" && (
                  <div className="flex flex-wrap gap-2">
                    {permissions.canMessage && (
                      <Button size="sm" onClick={() => navigate(`${pathFor("chat")}?with=${person.id}`)}><MessageCircle /> Message</Button>
                    )}
                    {permissions.canEdit && person.status !== "archived" && (
                      <Button size="sm" variant="secondary" onClick={() => onModeChange("edit")}><Pencil /> Edit</Button>
                    )}
                    {permissions.canRestore && (
                      <Button size="sm" variant="secondary" onClick={async () => { await restorePerson(person.id); }}><RotateCcw /> Restore</Button>
                    )}
                    {menuItems.length > 0 && <Menu items={menuItems} label={`More actions for ${fullName(person)}`} />}
                  </div>
                )}
              </header>
              <div className="grid gap-4 p-5">
                {mode === "edit" ? (
                  <EmployeeForm
                    person={person}
                    departments={departments}
                    onCancel={() => onModeChange("view")}
                    onSaved={() => { refreshPeople(); onModeChange("view"); }}
                  />
                ) : (
                  <>
                    <SegmentedControl label="Profile sections" options={tabs} value={tab} onChange={setTab} />
                    {tab === "overview" && <Overview data={data} />}
                    {tab === "time" && <Time attendance={data.attendance} />}
                    {tab === "leave" && <Leave leave={data.leave} />}
                    {tab === "history" && <History personId={person.id} />}
                  </>
                )}
              </div>
            </>
          )}
        </div>
      </Dialog>
      {person && <ArchiveDialog person={person} open={archiveOpen} onClose={() => setArchiveOpen(false)} onArchived={() => setArchiveOpen(false)} />}
    </>
  );
}
