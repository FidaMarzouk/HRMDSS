import { useCallback, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Search, UserPlus, X } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { usePresence } from "../../lib/queries";
import { cn } from "../../lib/utils";
import { pathFor } from "../../config/navigation";
import Pagination, { usePagination } from "../../components/Pagination";
import { Avatar } from "../../components/ui/avatar";
import { Button } from "../../components/ui/button";
import { Input, Select } from "../../components/ui/field";
import { Menu } from "../../components/ui/menu";
import { SegmentedControl } from "../../components/ui/segmented-control";
import { DepartmentsPanel } from "../employees/DepartmentsPanel";
import { employeeSearchValues, matchesQuery } from "../employees/employeeUtils";
import { ProfileDrawer } from "./ProfileDrawer";
import { ArchiveDialog } from "./ArchiveDialog";
import { useDepartments, usePeopleList } from "./peopleApi";
import { ACCESS_LABEL, fullName, presenceDot, skillNames, tenure, topSkills } from "./peopleUtils";

const PAGE_SIZE = 12;

function TenureBar({ hireDate }) {
  const t = tenure(hireDate);
  if (!t) return <span className="text-ink-3">—</span>;
  return (
    <span className="grid gap-1">
      <span className="h-1 rounded bg-sunk"><span className="block h-full rounded bg-teal" style={{ width: `${Math.min(100, t.years * 10)}%` }} /></span>
      <span className="figure text-[11px] text-ink-3">{t.label} · since {t.since}</span>
    </span>
  );
}

/**
 * Directory: HR manages everyone (and departments), the CEO views everyone,
 * a manager sees their team. Rows show presence, tenure and top skills; the
 * profile opens in a drawer (?person=<id>).
 */
export default function PeoplePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const role = user?.role;
  const isHr = role === "admin";
  const showDepartments = role === "admin" || role === "superAdmin";
  const [searchParams, setSearchParams] = useSearchParams();

  const [view, setView] = useState("people");
  const [archived, setArchived] = useState(false);
  // ?q= (from the command palette) pre-fills the search.
  const [query, setQuery] = useState(() => searchParams.get("q") || "");
  const [filters, setFilters] = useState({ department: "", skill: "", access: "" });
  const [drawer, setDrawer] = useState(() => ({ id: searchParams.get("person"), mode: searchParams.get("person") ? "view" : null }));
  const [archiving, setArchiving] = useState(null);

  const list = usePeopleList({ archived });
  const departmentsQuery = useDepartments(isHr);
  const presence = usePresence();
  const people = useMemo(() => list.data || [], [list.data]);

  const presenceById = useMemo(() => {
    const map = new Map();
    (presence.data?.departments || []).forEach((d) => d.people.forEach((p) => map.set(p.id, p.status)));
    return map;
  }, [presence.data]);

  const options = useMemo(() => {
    const depts = new Set();
    const skills = new Set();
    people.forEach((p) => {
      if (p.departmentId?.name) depts.add(p.departmentId.name);
      skillNames(p.skills).forEach((s) => skills.add(s));
    });
    return { departments: [...depts].sort(), skills: [...skills].sort((a, b) => a.localeCompare(b)) };
  }, [people]);

  const filtered = useMemo(
    () =>
      people.filter(
        (p) =>
          matchesQuery(query, employeeSearchValues(p)) &&
          (!filters.department || p.departmentId?.name === filters.department) &&
          (!filters.skill || skillNames(p.skills).some((s) => s.toLowerCase() === filters.skill.toLowerCase())) &&
          (!filters.access || p.role === filters.access)
      ),
    [people, query, filters]
  );
  const paging = usePagination(filtered, PAGE_SIZE, `${query}|${JSON.stringify(filters)}|${archived}`);

  const openDrawer = useCallback(
    (id, mode = "view") => {
      setDrawer({ id, mode });
      const next = new URLSearchParams(searchParams);
      if (id) next.set("person", id);
      else next.delete("person");
      setSearchParams(next, { replace: true });
    },
    [searchParams, setSearchParams]
  );

  const chips = [
    filters.department && { key: "department", label: `dept: ${filters.department}` },
    filters.skill && { key: "skill", label: `skill: ${filters.skill}` },
    filters.access && { key: "access", label: `access: ${ACCESS_LABEL[filters.access]}` },
  ].filter(Boolean);

  const title = role === "manager" ? "My team" : "People";

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl font-bold leading-tight">{title}</h2>
          <p className="text-[13px] text-ink-2">
            {view === "people" ? `${filtered.length} ${archived ? "archived " : ""}${filtered.length === 1 ? "person" : "people"}` : "Departments, heads and headcount"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {showDepartments && (
            <SegmentedControl label="View" value={view} onChange={setView} options={[{ value: "people", label: "People" }, { value: "departments", label: "Departments" }]} />
          )}
          {isHr && view === "people" && (
            <SegmentedControl label="Status" value={archived ? "archived" : "active"} onChange={(v) => setArchived(v === "archived")} options={[{ value: "active", label: "Active" }, { value: "archived", label: "Archived" }]} />
          )}
          {isHr && view === "people" && (
            <Button onClick={() => openDrawer(null, "create")}><UserPlus /> Add person</Button>
          )}
        </div>
      </div>

      {view === "departments" ? (
        <DepartmentsPanel canEdit={isHr} />
      ) : (
        <>
          <div className="grid gap-2 lg:grid-cols-[minmax(0,2fr)_repeat(3,minmax(0,1fr))]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3" aria-hidden="true" />
              <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search name, position, email or skill…" aria-label="Search people" className="pl-9" />
            </div>
            {role !== "manager" && (
              <Select aria-label="Filter by department" value={filters.department} onChange={(e) => setFilters((f) => ({ ...f, department: e.target.value }))}>
                <option value="">All departments</option>
                {options.departments.map((d) => <option key={d} value={d}>{d}</option>)}
              </Select>
            )}
            <Select aria-label="Filter by skill" value={filters.skill} onChange={(e) => setFilters((f) => ({ ...f, skill: e.target.value }))}>
              <option value="">Any skill</option>
              {options.skills.map((s) => <option key={s} value={s}>{s}</option>)}
            </Select>
            {role !== "manager" && (
              <Select aria-label="Filter by access" value={filters.access} onChange={(e) => setFilters((f) => ({ ...f, access: e.target.value }))}>
                <option value="">Any access</option>
                <option value="manager">Managers</option>
                <option value="employee">Employees</option>
              </Select>
            )}
          </div>

          {chips.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {chips.map((c) => (
                <button
                  key={c.key}
                  type="button"
                  onClick={() => setFilters((f) => ({ ...f, [c.key]: "" }))}
                  className="inline-flex h-7 items-center gap-1 rounded-full border border-teal/40 px-2.5 text-xs text-teal hover:bg-teal/10"
                  aria-label={`Remove filter ${c.label}`}
                >
                  {c.label} <X className="h-3 w-3" />
                </button>
              ))}
            </div>
          )}

          {list.isError && <p role="alert" className="rounded-md border border-red/30 bg-red/10 px-3 py-2 text-sm text-red">People could not be loaded.</p>}

          <div className="overflow-x-auto rounded-xl border border-line">
            <table className="w-full min-w-[720px] text-left text-[13px]">
              <thead className="border-b border-line font-mono text-[10.5px] uppercase tracking-[0.1em] text-ink-3">
                <tr>
                  <th scope="col" className="px-3 py-2 font-normal">Person</th>
                  <th scope="col" className="px-3 py-2 font-normal">Access</th>
                  {role !== "manager" && <th scope="col" className="px-3 py-2 font-normal">Department</th>}
                  <th scope="col" className="w-40 px-3 py-2 font-normal">Tenure</th>
                  <th scope="col" className="px-3 py-2 font-normal">Top skills</th>
                  <th scope="col" className="px-3 py-2 font-normal"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {list.isLoading &&
                  [0, 1, 2, 3].map((i) => (
                    <tr key={i}><td colSpan={6} className="px-3 py-2"><div className="h-9 animate-pulse rounded bg-sunk" /></td></tr>
                  ))}
                {!list.isLoading && paging.pageItems.length === 0 && (
                  <tr><td colSpan={6} className="px-3 py-10 text-center text-ink-2">{archived ? "No one has been archived." : "No one matches these filters."}</td></tr>
                )}
                {paging.pageItems.map((p) => {
                  const id = p._id;
                  const selected = drawer.id === id;
                  const status = presenceById.get(id);
                  const menu = [
                    { label: "Open profile", onSelect: () => openDrawer(id) },
                    ...(isHr && !archived ? [{ label: "Edit details", onSelect: () => openDrawer(id, "edit") }] : []),
                    ...(!archived ? [{ label: "Message", onSelect: () => navigate(`${pathFor("chat")}?with=${id}`) }] : []),
                    ...(isHr && !archived
                      ? [
                          { divider: true },
                          // Managers may still lead a team: the profile says whether they can be archived.
                          p.role === "manager"
                            ? { label: "Archive… (opens profile)", danger: true, onSelect: () => openDrawer(id) }
                            : { label: "Archive…", danger: true, onSelect: () => setArchiving({ id, firstName: p.firstName, lastName: p.lastName }) },
                        ]
                      : []),
                  ];
                  return (
                    <tr key={id} className={cn("border-t border-line", selected ? "bg-teal/10 shadow-[inset_3px_0_0_rgb(var(--teal))]" : "hover:bg-sunk")}>
                      <td className="px-3 py-2">
                        <button type="button" onClick={() => openDrawer(id)} className="flex min-w-0 items-center gap-2.5 text-left">
                          <Avatar user={p} presence={archived ? undefined : presenceDot(status)} />
                          <span className="min-w-0">
                            <b className="block truncate text-[13.5px] font-semibold">{fullName(p)}</b>
                            <span className="block truncate text-xs text-ink-2">{p.position}</span>
                          </span>
                        </button>
                      </td>
                      <td className={cn("px-3 py-2 font-mono text-[10.5px] uppercase tracking-[0.06em]", p.role === "manager" ? "text-teal" : "text-ink-3")}>{ACCESS_LABEL[p.role]}</td>
                      {role !== "manager" && <td className="px-3 py-2 text-ink-2">{p.departmentId?.name || "—"}</td>}
                      <td className="px-3 py-2"><TenureBar hireDate={p.hireDate} /></td>
                      <td className="px-3 py-2">
                        <span className="flex flex-wrap gap-1">
                          {topSkills(p.skills).map((s) => (
                            <span key={s} className="rounded border border-line-2 px-1.5 text-[11px] text-ink-2">{s}</span>
                          ))}
                        </span>
                      </td>
                      <td className="px-1 py-1 text-right"><Menu items={menu} label={`Actions for ${fullName(p)}`} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {filtered.length > PAGE_SIZE && <Pagination {...paging.pagination} noun="people" />}
        </>
      )}

      <ProfileDrawer
        personId={drawer.mode === "create" ? null : drawer.id}
        mode={drawer.mode || "view"}
        departments={departmentsQuery.data || []}
        onClose={() => openDrawer(null)}
        onModeChange={(mode) => setDrawer((d) => ({ ...d, mode }))}
      />
      {archiving && <ArchiveDialog person={archiving} open onClose={() => setArchiving(null)} onArchived={() => setArchiving(null)} />}
    </div>
  );
}
