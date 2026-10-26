import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { getISOWeek } from "date-fns";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import api, { errorMessage } from "../../lib/api";
import { Button } from "../../components/ui/button";
import { Select } from "../../components/ui/field";
import { Switch } from "../../components/ui/switch";
import { SegmentedControl } from "../../components/ui/segmented-control";
import { Legend } from "../../components/marks/MarkFrame";
import { cn } from "../../lib/utils";
import { EVENT_TYPES, STATE_LABEL, stateOf } from "./meta";
import { addDays, addMonths, formatKey, monthEnd, monthGrid, monthStart, mondayOf, todayKey } from "./time";
import { useEvents, useResourceWeek } from "./calendarApi";
import { MonthView } from "./MonthView";
import { WeekView } from "./WeekView";
import { ListView } from "./ListView";
import { ResourceLanes } from "./ResourceLanes";
import { DayDrawer } from "./DayDrawer";
import { EventDrawer } from "./EventDrawer";
import { EventDialog } from "./EventDialog";

const VIEWS = [
  { value: "month", label: "Month" },
  { value: "week", label: "Week" },
  { value: "list", label: "List" },
  { value: "resources", label: "Resources" },
];
const DAY_KEY = /^\d{4}-\d{2}-\d{2}$/;
const STATES = ["confirmed", "pending", "clash", "declined"];

// ISO week number of a company day.
const isoWeek = (key) => getISOWeek(new Date(`${key}T12:00:00`));

function Toggle({ pressed, onClick, children }) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={cn("inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-[12.5px]", pressed ? "border-teal bg-teal/10 text-ink" : "border-line-2 text-ink-2 hover:border-edge")}
    >
      {children}
    </button>
  );
}

/**
 * Calendar: month (density), week, list and resource lanes. Meetings,
 * missions and bookings are told apart by icon; colour shows state.
 * View and date live in the URL (?view=resources&date=2026-10-19).
 */
export default function CalendarPage() {
  const [params, setParams] = useSearchParams();
  const view = VIEWS.some((v) => v.value === params.get("view")) ? params.get("view") : "month";
  const date = DAY_KEY.test(params.get("date") || "") ? params.get("date") : todayKey();
  const go = (changes) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        Object.entries(changes).forEach(([k, v]) => (v == null ? next.delete(k) : next.set(k, v)));
        return next;
      },
      { replace: true }
    );

  const [types, setTypes] = useState([]);
  const [states, setStates] = useState([]);
  const [department, setDepartment] = useState("");
  const [showPending, setShowPending] = useState(true);
  const [day, setDay] = useState(null);
  const [selected, setSelected] = useState(null);
  const [editor, setEditor] = useState({ open: false, event: null, preset: null });

  const monday = mondayOf(date);
  const span = useMemo(() => {
    if (view === "month") {
      const grid = monthGrid(date);
      return { from: grid[0], to: grid[grid.length - 1] };
    }
    if (view === "week") return { from: monday, to: addDays(monday, 6) };
    if (view === "resources") return { from: monday, to: addDays(monday, 4) };
    return { from: monthStart(date), to: monthEnd(date) };
  }, [view, date, monday]);

  const events = useEvents(span.from, span.to);
  const week = useResourceWeek(monday, 5, view === "resources");
  const departments = useQuery({ queryKey: ["departments"], queryFn: async () => (await api.get("/api/departments")).data, staleTime: 5 * 60_000 });

  const filtered = useMemo(
    () =>
      (events.data || []).filter(
        (e) =>
          (!types.length || types.includes(e.eventType)) &&
          (!states.length || states.includes(stateOf(e))) &&
          (!department || String(e.departmentId?._id || e.departmentId) === department)
      ),
    [events.data, types, states, department]
  );

  const step = (dir) => {
    if (view === "month" || view === "list") go({ date: addMonths(date, dir) });
    else go({ date: addDays(monday, 7 * dir) });
  };
  const heading =
    view === "month" || view === "list"
      ? new Date(`${date.slice(0, 7)}-01T12:00:00Z`).toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" })
      : `${formatKey(monday, { day: "numeric", month: "short" })} → ${formatKey(addDays(monday, view === "week" ? 6 : 4), { day: "numeric", month: "short", year: "numeric" })} · week ${isoWeek(monday)}`;

  const openEvent = (e) => setSelected(e);
  // Lane bookings carry only what the viewer may see; use the full event when we have it.
  const openBooking = (b) =>
    setSelected(
      (events.data || []).find((e) => e._id === b.id) || {
        _id: b.id,
        title: b.title,
        eventType: b.eventType,
        startDateTime: b.startDateTime,
        endDateTime: b.endDateTime,
        status: b.status,
        state: b.state,
        private: b.private,
        by: b.by,
      }
    );
  const toggle = (list, setList, value) => setList(list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);
  const loading = view === "resources" ? !week.data : !events.data;
  const failed = view === "resources" ? week.isError && week.error : events.isError && events.error;

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="label-key">Meetings · missions · bookings</p>
          <h2 className="font-display text-2xl font-bold leading-tight">Calendar</h2>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <SegmentedControl label="View" value={view} onChange={(v) => go({ view: v })} options={VIEWS} />
          <Button onClick={() => setEditor({ open: true, event: null, preset: { day: date } })}>
            <Plus aria-hidden /> New event
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => step(-1)} aria-label="Previous" className="grid h-9 w-9 place-items-center rounded-md text-ink-2 hover:bg-sunk hover:text-ink"><ChevronLeft className="h-4 w-4" /></button>
          <button type="button" onClick={() => step(1)} aria-label="Next" className="grid h-9 w-9 place-items-center rounded-md text-ink-2 hover:bg-sunk hover:text-ink"><ChevronRight className="h-4 w-4" /></button>
          <h3 className="figure ml-1 text-[15px] font-medium text-ink" aria-live="polite">{heading}</h3>
          <Button variant="ghost" size="sm" className="ml-2" onClick={() => go({ date: null })}>Today</Button>
        </div>
        {view === "resources" ? (
          <div className="flex flex-wrap items-center gap-4">
            <Legend
              items={[
                { label: "Confirmed", className: "bg-teal" },
                { label: "Pending approval", className: "border-[1.5px] border-dashed border-teal" },
                { label: "Clash", className: "border-[1.5px] border-red bg-red/10" },
              ]}
            />
            <span className="text-[11.5px] text-ink-3">each column = 08:00–18:00</span>
            <label className="flex items-center gap-2 text-[13px] text-ink-2">
              <span aria-hidden="true">Show pending</span>
              <Switch checked={showPending} onChange={setShowPending} label="Show pending bookings" />
            </label>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Filters">
            {Object.entries(EVENT_TYPES).map(([value, t]) => (
              <Toggle key={value} pressed={types.includes(value)} onClick={() => toggle(types, setTypes, value)}>
                <t.Icon className="h-3.5 w-3.5" aria-hidden /> {t.label}
              </Toggle>
            ))}
            <span className="mx-1 h-5 w-px bg-line" aria-hidden="true" />
            {STATES.map((s) => (
              <Toggle key={s} pressed={states.includes(s)} onClick={() => toggle(states, setStates, s)}>{STATE_LABEL[s]}</Toggle>
            ))}
            {departments.data?.length > 0 && (
              <Select value={department} onChange={(e) => setDepartment(e.target.value)} aria-label="Department" className="ml-1 h-8 w-auto text-[12.5px]">
                <option value="">All departments</option>
                {departments.data.map((d) => (
                  <option key={d._id} value={d._id}>{d.name}</option>
                ))}
              </Select>
            )}
          </div>
        )}
      </div>

      <section className="rounded-xl border border-line bg-panel p-3 sm:p-4" aria-busy={loading}>
        {failed ? (
          <p role="alert" className="py-10 text-center text-[13px] text-red">Could not load the calendar: {errorMessage(failed)}</p>
        ) : loading ? (
          <div className="h-96 animate-pulse rounded-lg bg-sunk" />
        ) : view === "month" ? (
          <MonthView date={date} events={filtered} onOpenDay={setDay} />
        ) : view === "week" ? (
          <WeekView monday={monday} events={filtered} onOpen={openEvent} onOpenDay={setDay} />
        ) : view === "list" ? (
          <ListView events={filtered} from={span.from} to={span.to} onOpen={openEvent} />
        ) : (
          <ResourceLanes data={week.data} showPending={showPending} onOpen={openBooking} onBook={(resource, k) => setEditor({ open: true, event: null, preset: { day: k, resource } })} />
        )}
      </section>

      <DayDrawer
        day={day}
        events={filtered}
        onClose={() => setDay(null)}
        onOpen={(e) => {
          setDay(null);
          openEvent(e);
        }}
        onCreate={(k) => {
          setDay(null);
          setEditor({ open: true, event: null, preset: { day: k } });
        }}
        onShowResources={(k) => {
          setDay(null);
          go({ view: "resources", date: k });
        }}
      />
      <EventDrawer
        event={selected}
        onClose={() => setSelected(null)}
        onEdit={(e) => {
          setSelected(null);
          setEditor({ open: true, event: e, preset: null });
        }}
      />
      <EventDialog open={editor.open} event={editor.event} preset={editor.preset} onClose={() => setEditor({ open: false, event: null, preset: null })} />
    </div>
  );
}
