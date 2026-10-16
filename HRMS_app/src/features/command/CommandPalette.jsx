import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search } from "lucide-react";
import { Dialog } from "../../components/ui/dialog";
import { Kbd } from "../../components/ui/kbd";
import { useAuth } from "../../context/AuthContext";
import { useTheme } from "../../theme/theme";
import api, { errorMessage } from "../../lib/api";
import { showError, showSuccess } from "../../lib/alerts";
import { invalidateShell, usePeopleSearch, useToday, useTodaySessions } from "../../lib/queries";
import { openAssistant } from "../../lib/assistant";
import { cn } from "../../lib/utils";
import { pagesFor, pathFor } from "../../config/navigation";
import { approveItem } from "../today/decisions";
import { describeWhen } from "../today/describe";
import { summarizeSessions } from "../time/sessions";

const GROUP_ORDER = ["DECISIONS", "ACTIONS", "PEOPLE", "PAGES", "ASK THE ASSISTANT"];
const PER_GROUP = { DECISIONS: 5, ACTIONS: 6, PEOPLE: 6, PAGES: 8, "ASK THE ASSISTANT": 1 };

const matches = (words, text) => words.every((w) => text.includes(w));

// Debounced copy of a value.
const useDebounced = (value, ms) => {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
};

const punch = (path, title) => async () => {
  try {
    await api.post(path);
    invalidateShell();
    showSuccess(title);
  } catch (err) {
    showError("Could not update attendance", errorMessage(err));
  }
};

/**
 * Ctrl K / Cmd K: search people and pages and run actions from anywhere.
 * Commands: { id, group, label, hint, keywords, run }.
 */
export function CommandPalette({ open, onClose, onLogout }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { setMode } = useTheme();
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const listId = useId();
  const listRef = useRef(null);

  const reviewer = user?.role !== "employee";
  const today = useToday();
  const sessions = useTodaySessions();
  const debounced = useDebounced(query, 200);
  const people = usePeopleSearch(open ? debounced : "");
  const pages = useMemo(() => pagesFor(user?.role), [user?.role]);
  const hasPeoplePage = pages.some((p) => p.key === "people");

  useEffect(() => {
    if (open) {
      setQuery("");
      setActive(0);
    }
  }, [open]);

  const commands = useMemo(() => {
    const list = [];
    if (reviewer) {
      (today.data?.queue || []).forEach((item) =>
        list.push({
          id: `approve:${item.id}`,
          group: "DECISIONS",
          label: `Approve · ${item.title}`,
          hint: describeWhen(item),
          keywords: `approve accept decision ${item.title} ${item.kind}`,
          run: () => approveItem(item),
        })
      );
    }

    if (user?.role !== "superAdmin") {
      list.push({ id: "request-leave", group: "ACTIONS", label: "Request leave", keywords: "new leave request vacation time off", run: () => navigate(`${pathFor("leave")}?new=1`) });
    }
    const shift = summarizeSessions(sessions.data || []);
    if (shift.state === "out" || shift.state === "left") list.push({ id: "punch-in", group: "ACTIONS", label: "Punch in", keywords: "punch in clock start attendance", run: punch("/api/attendance/punch-in", "Punched in") });
    if (shift.state === "in") list.push({ id: "break-start", group: "ACTIONS", label: "Start break", keywords: "break lunch pause", run: punch("/api/attendance/break/start", "Break started") });
    if (shift.state === "break") list.push({ id: "break-end", group: "ACTIONS", label: "End break", keywords: "break end resume back", run: punch("/api/attendance/break/end", "Break ended") });
    if (shift.state === "in" || shift.state === "break") list.push({ id: "punch-out", group: "ACTIONS", label: "Punch out", keywords: "punch out clock leave stop attendance", run: punch("/api/attendance/punch-out", "Punched out") });
    list.push({ id: "theme-light", group: "ACTIONS", label: "Use light theme", keywords: "theme light day mode", run: () => setMode("light") });
    list.push({ id: "theme-dark", group: "ACTIONS", label: "Use dark theme", keywords: "theme dark night mode", run: () => setMode("dark") });
    list.push({ id: "theme-auto", group: "ACTIONS", label: "Follow system theme", keywords: "theme auto system os", run: () => setMode("auto") });
    list.push({ id: "logout", group: "ACTIONS", label: "Log out", keywords: "logout sign out exit", run: onLogout });

    (people.data?.people || []).forEach((p) =>
      list.push({
        id: `person:${p.id}`,
        group: "PEOPLE",
        label: `${p.firstName} ${p.lastName}`,
        hint: [p.position, p.department].filter(Boolean).join(" · "),
        keywords: `${p.firstName} ${p.lastName} ${p.position || ""} ${p.department || ""} ${p.email || ""}`,
        searchMatch: true,
        run: () =>
          navigate(hasPeoplePage ? `${pathFor("people")}?person=${p.id}` : `${pathFor("chat")}?with=${p.id}`),
      })
    );

    pages.forEach((p) =>
      list.push({ id: `page:${p.key}`, group: "PAGES", label: p.label, hint: "Page", keywords: `${p.label} ${p.key} ${p.keywords || ""}`, run: () => navigate(pathFor(p.key)) })
    );
    return list;
  }, [reviewer, today.data, user?.role, sessions.data, people.data, pages, hasPeoplePage, navigate, setMode, onLogout]);

  const visible = useMemo(() => {
    const words = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
    const picked = commands.filter((c) => c.searchMatch || matches(words, `${c.label} ${c.keywords}`.toLowerCase()));
    if (words.length) {
      picked.push({ id: "ask", group: "ASK THE ASSISTANT", label: `Ask the ENOVA Assistant: "${query.trim()}"`, run: () => openAssistant(query.trim()) });
    }
    const out = [];
    GROUP_ORDER.forEach((g) => out.push(...picked.filter((c) => c.group === g).slice(0, PER_GROUP[g])));
    return out;
  }, [commands, query]);

  useEffect(() => setActive(0), [query]);

  useEffect(() => {
    listRef.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: "nearest" });
  }, [active]);

  const run = (command) => {
    if (!command) return;
    onClose();
    command.run?.();
  };

  const onKeyDown = (e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => Math.min(visible.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(0, i - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      run(visible[active]);
    }
  };

  let lastGroup = null;
  return (
    <Dialog open={open} onClose={onClose} hideClose labelledBy={`${listId}-label`} className="max-w-xl self-start sm:mt-[10vh]">
      <div className="-mx-5 -my-4">
        <div className="flex items-center gap-3 border-b border-line px-4 py-3">
          <Search className="h-4 w-4 flex-none text-teal" aria-hidden="true" />
          <label id={`${listId}-label`} htmlFor={`${listId}-input`} className="sr-only">
            Search or run a command
          </label>
          <input
            id={`${listId}-input`}
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Search people, pages and actions…"
            role="combobox"
            aria-expanded="true"
            aria-controls={listId}
            aria-activedescendant={visible[active] ? `${listId}-${visible[active].id}` : undefined}
            autoComplete="off"
            className="min-w-0 flex-1 bg-transparent text-[15px] text-ink placeholder:text-ink-3 focus:outline-none"
          />
          <Kbd>ESC</Kbd>
        </div>
        <ul id={listId} ref={listRef} role="listbox" className="max-h-[min(60vh,420px)] overflow-y-auto p-1.5">
          {visible.length === 0 && <li className="px-3 py-6 text-center text-sm text-ink-2">{people.isFetching ? "Searching…" : "No matches"}</li>}
          {visible.map((c, i) => {
            const header = c.group !== lastGroup;
            lastGroup = c.group;
            return (
              <li key={c.id} role="presentation">
                {header && <p className="px-2 pb-1 pt-2 font-mono text-[9.5px] tracking-[0.14em] text-ink-3">{c.group}</p>}
                <div
                  id={`${listId}-${c.id}`}
                  role="option"
                  aria-selected={i === active}
                  data-active={i === active}
                  onMouseMove={() => setActive(i)}
                  onClick={() => run(c)}
                  className={cn(
                    "flex min-h-10 cursor-pointer items-center gap-3 rounded-md px-2.5 py-2 text-[13.5px]",
                    i === active ? "bg-teal/10 outline outline-1 outline-teal/40" : "hover:bg-sunk"
                  )}
                >
                  <span className="min-w-0 flex-1 truncate">{c.label}</span>
                  {c.hint && <span className="hidden truncate text-xs text-ink-3 sm:block sm:max-w-[45%]">{c.hint}</span>}
                  {i === active && <Kbd>ENTER</Kbd>}
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </Dialog>
  );
}
