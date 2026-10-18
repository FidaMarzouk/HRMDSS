import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { Dialog } from "../../components/ui/dialog";
import { Button } from "../../components/ui/button";
import { Field, Input, Select, Textarea } from "../../components/ui/field";
import { SegmentedControl } from "../../components/ui/segmented-control";
import { companyDateTime, toDayKey, toTimeInputValue } from "../../lib/dates";
import { showWarning } from "../../lib/alerts";
import { useAuth } from "../../context/AuthContext";
import { EVENT_TYPES, RESOURCE_ORDER, RESOURCE_TYPES, ROOM_TYPES, VISIBILITY } from "./meta";
import { clock, todayKey } from "./time";
import { checkAvailability, saveEvent, usePeople, useResources } from "./calendarApi";
import { PeoplePicker } from "./PeoplePicker";

const idOf = (v) => (v && typeof v === "object" ? v._id : v);

// Next half hour in company time, as "HH:MM".
const nextSlot = () => {
  const [h, m] = toTimeInputValue(new Date()).split(":").map(Number);
  const total = Math.min(23 * 60, Math.ceil((h * 60 + m + 1) / 30) * 30);
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
};
const plusMinutes = (hhmm, n) => {
  const [h, m] = hhmm.split(":").map(Number);
  const t = Math.min(23 * 60 + 59, h * 60 + m + n);
  return `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
};

const formFrom = (event, preset) => {
  if (event) {
    return {
      title: event.title || "",
      eventType: event.eventType || "meeting",
      startDay: toDayKey(event.startDateTime),
      startTime: toTimeInputValue(event.startDateTime),
      endDay: toDayKey(event.endDateTime),
      endTime: toTimeInputValue(event.endDateTime),
      visibility: event.visibility || "public",
      description: event.description || "",
      location: event.location || "",
      destination: event.destination || "",
      resource: idOf(event.resource) || "",
      usersInvolved: (event.usersInvolved || []).map((u) => String(idOf(u.userId))).filter(Boolean),
    };
  }
  const day = preset?.day && preset.day >= todayKey() ? preset.day : todayKey();
  const start = preset?.day && preset.day > todayKey() ? "09:00" : nextSlot();
  return {
    title: "",
    eventType: preset?.resource ? (ROOM_TYPES.includes(preset.resource.type) ? "meeting" : "resourceReservation") : "meeting",
    startDay: day,
    startTime: start,
    endDay: day,
    endTime: plusMinutes(start, 60),
    visibility: "public",
    description: "",
    location: "",
    destination: "",
    resource: preset?.resource?.id || "",
    usersInvolved: [],
  };
};

/** Create or edit a meeting, mission or booking. Times are company time. */
export function EventDialog({ open, event, preset, onClose }) {
  const { user } = useAuth();
  const [form, setForm] = useState(() => formFrom(event, preset));
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [availability, setAvailability] = useState(null);
  const resources = useResources(open);
  const people = usePeople(open);
  const editing = Boolean(event);

  useEffect(() => {
    if (open) {
      setForm(formFrom(event, preset));
      setError(null);
    }
  }, [open, event, preset]);

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const startISO = companyDateTime(form.startDay, form.startTime);
  const endISO = companyDateTime(form.endDay, form.endTime);
  const needsResource = form.eventType === "resourceReservation" || (form.eventType === "meeting" && form.resource);

  const choices = useMemo(() => {
    const list = resources.data || [];
    const types = form.eventType === "meeting" ? ROOM_TYPES : RESOURCE_ORDER;
    return types.map((t) => ({ type: t, items: list.filter((r) => r.type === t) })).filter((g) => g.items.length);
  }, [resources.data, form.eventType]);

  // Live availability of the chosen resource for the chosen time.
  useEffect(() => {
    if (!open || !needsResource || !form.resource || !startISO || !endISO || endISO <= startISO) {
      setAvailability(null);
      return undefined;
    }
    let cancelled = false;
    const t = setTimeout(async () => {
      try {
        const data = await checkAvailability({ resourceId: form.resource, startDateTime: startISO, endDateTime: endISO, eventId: event?._id });
        if (!cancelled) setAvailability(data);
      } catch {
        if (!cancelled) setAvailability(null);
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [open, needsResource, form.resource, startISO, endISO, event?._id]);

  const submit = async (e) => {
    e.preventDefault();
    if (!startISO || !endISO || new Date(endISO) <= new Date(startISO)) {
      setError({ message: "The end must be after the start." });
      return;
    }
    setSaving(true);
    const chosen = (resources.data || []).find((r) => r._id === form.resource);
    const body = {
      title: form.title.trim(),
      eventType: form.eventType,
      startDateTime: startISO,
      endDateTime: endISO,
      visibility: form.visibility,
      description: form.description,
      usersInvolved: form.usersInvolved,
    };
    if (form.eventType === "meeting") {
      body.location = form.location.trim() || chosen?.name || "";
      body.resource = form.resource || (editing ? null : undefined);
    }
    if (form.eventType === "mission") body.destination = form.destination;
    if (form.eventType === "resourceReservation") body.resource = form.resource;
    const result = await saveEvent(event?._id, body);
    setSaving(false);
    if (!result.ok) {
      setError(result);
      return;
    }
    const pending = result.event?.clashes || [];
    if (pending.length) {
      showWarning("Saved, with a clash", `${pending.length} other request${pending.length === 1 ? " is" : "s are"} pending for ${chosen?.name || "this resource"} at that time. HR approves one of them.`);
    }
    onClose(result.event);
  };

  const conflicts = error?.conflicts || [];
  const free = availability?.available && !availability.pendingClashes?.length;

  return (
    <Dialog
      open={open}
      onClose={() => onClose()}
      title={editing ? "Edit event" : "New event"}
      description={user?.role === "admin" ? "Events you create are confirmed straight away." : "HR approves meetings, missions and bookings."}
      className="max-w-2xl"
      footer={
        <>
          <Button variant="ghost" onClick={() => onClose()}>Cancel</Button>
          <Button type="submit" form="event-form" disabled={saving || availability?.available === false}>
            {saving ? "Saving…" : editing ? "Save changes" : "Create event"}
          </Button>
        </>
      }
    >
      <form id="event-form" onSubmit={submit} className="grid gap-4" noValidate>
        {!editing && (
          <SegmentedControl
            label="Type"
            value={form.eventType}
            onChange={(v) => set({ eventType: v, resource: v === form.eventType ? form.resource : "" })}
            options={Object.entries(EVENT_TYPES).map(([value, t]) => ({ value, label: t.label }))}
          />
        )}
        <Field label="Title" required>
          <Input value={form.title} onChange={(e) => set({ title: e.target.value })} required maxLength={120} />
        </Field>

        <div className="grid gap-3 sm:grid-cols-2">
          <fieldset className="grid gap-1.5">
            <legend className="mb-1.5 text-xs font-medium text-ink-2">Starts</legend>
            <div className="grid grid-cols-[minmax(0,1fr)_110px] gap-2">
              <Input type="date" value={form.startDay} onChange={(e) => set({ startDay: e.target.value, endDay: form.endDay < e.target.value ? e.target.value : form.endDay })} aria-label="Start date" />
              <Input type="time" step={300} value={form.startTime} onChange={(e) => set({ startTime: e.target.value })} aria-label="Start time" />
            </div>
          </fieldset>
          <fieldset className="grid gap-1.5">
            <legend className="mb-1.5 text-xs font-medium text-ink-2">Ends</legend>
            <div className="grid grid-cols-[minmax(0,1fr)_110px] gap-2">
              <Input type="date" value={form.endDay} min={form.startDay} onChange={(e) => set({ endDay: e.target.value })} aria-label="End date" />
              <Input type="time" step={300} value={form.endTime} onChange={(e) => set({ endTime: e.target.value })} aria-label="End time" />
            </div>
          </fieldset>
        </div>

        {(form.eventType === "resourceReservation" || form.eventType === "meeting") && (
          <Field label={form.eventType === "meeting" ? "Room" : "What to book"} hint={form.eventType === "meeting" ? "Optional. A booked room shows in its lane and is checked for clashes." : undefined} required={form.eventType === "resourceReservation"}>
            <Select value={form.resource} onChange={(e) => set({ resource: e.target.value })}>
              <option value="">{form.eventType === "meeting" ? "No room" : "Choose a resource"}</option>
              {choices.map((g) => (
                <optgroup key={g.type} label={RESOURCE_TYPES[g.type]?.label || g.type}>
                  {g.items.map((r) => (
                    <option key={r._id} value={r._id} disabled={r.status === "maintenance"}>
                      {r.name}{r.status === "maintenance" ? " (under maintenance)" : ""}
                    </option>
                  ))}
                </optgroup>
              ))}
            </Select>
          </Field>
        )}

        {availability && (
          <div role="status" className={free ? "flex items-start gap-2 text-[12.5px] text-teal" : "grid gap-1 rounded-lg border border-red/40 bg-red/5 p-2.5 text-[12.5px]"}>
            {free ? (
              <>
                <CheckCircle2 className="mt-0.5 h-4 w-4 flex-none" aria-hidden /> Free at that time.
              </>
            ) : (
              <>
                <p className="flex items-center gap-1.5 font-semibold text-red"><AlertTriangle className="h-4 w-4" aria-hidden /> {availability.available ? "Other requests are pending for that time" : availability.message}</p>
                {[...(availability.conflictingEvents || []), ...(availability.pendingClashes || [])].map((c) => (
                  <p key={c.id} className="text-ink-2">
                    {c.status === "approved" ? "Confirmed" : "Pending"}: <span className="text-ink">{c.title}</span> · {c.by} · <span className="figure">{clock(c.startDateTime)}–{clock(c.endDateTime)}</span>
                  </p>
                ))}
                <p className="text-ink-3">{availability.available ? "You can still ask: HR approves one request and the others are blocked." : "Pick another time or resource."}</p>
              </>
            )}
          </div>
        )}

        {form.eventType === "meeting" && (
          <Field label="Location" hint={form.resource ? "Leave empty to use the room's name." : undefined} required={!form.resource}>
            <Input value={form.location} onChange={(e) => set({ location: e.target.value })} maxLength={120} />
          </Field>
        )}
        {form.eventType === "mission" && (
          <Field label="Destination" required>
            <Input value={form.destination} onChange={(e) => set({ destination: e.target.value })} maxLength={120} />
          </Field>
        )}
        <Field label="Description" required={form.eventType !== "resourceReservation"}>
          <Textarea value={form.description} onChange={(e) => set({ description: e.target.value })} rows={3} maxLength={2000} />
        </Field>

        <Field label="Who can see it">
          <Select value={form.visibility} onChange={(e) => set({ visibility: e.target.value })}>
            {Object.entries(VISIBILITY).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </Select>
        </Field>

        <div className="grid gap-1.5">
          <p className="text-[13px] font-medium text-ink">Invite people</p>
          {people.data ? (
            <PeoplePicker people={people.data} value={form.usersInvolved} onChange={(ids) => set({ usersInvolved: ids })} excludeId={user?.id} />
          ) : (
            <div className="h-24 animate-pulse rounded-lg bg-sunk" />
          )}
        </div>

        {error && (
          <div role="alert" className="grid gap-1 rounded-lg border border-red/40 bg-red/5 p-3 text-[12.5px]">
            <p className="font-semibold text-red">{error.message}</p>
            {conflicts.map((c) => (
              <p key={c.id} className="text-ink-2">
                <span className="text-ink">{c.title}</span> · {c.by} · <span className="figure">{clock(c.startDateTime)}–{clock(c.endDateTime)}</span>
              </p>
            ))}
          </div>
        )}
      </form>
    </Dialog>
  );
}
