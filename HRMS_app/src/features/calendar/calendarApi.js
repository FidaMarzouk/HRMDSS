import { keepPreviousData, useQuery } from "@tanstack/react-query";
import api, { errorMessage } from "../../lib/api";
import { invalidateShell, queryClient } from "../../lib/queries";
import { showError, showSuccess } from "../../lib/alerts";

export const calendarKeys = {
  all: ["calendar"],
  events: (from, to) => ["calendar", "events", from, to],
  week: (start, days) => ["calendar", "resources-week", start, days],
  resources: ["calendar", "resources"],
  people: ["calendar", "people"],
};

const get = (url, params) => async () => (await api.get(url, { params })).data;

export const useEvents = (from, to) =>
  useQuery({ queryKey: calendarKeys.events(from, to), queryFn: get("/api/calendar/events", { startDate: from, endDate: to }), placeholderData: keepPreviousData });

export const useResourceWeek = (start, days, enabled = true) =>
  useQuery({ queryKey: calendarKeys.week(start, days), queryFn: get("/api/calendar/resources/week", { start, days }), placeholderData: keepPreviousData, enabled });

export const useResources = (enabled = true) =>
  useQuery({ queryKey: calendarKeys.resources, queryFn: get("/api/calendar/resources"), staleTime: 60_000, enabled });

export const usePeople = (enabled = true) =>
  useQuery({ queryKey: calendarKeys.people, queryFn: async () => (await api.get("/api/calendar/users")).data.users, staleTime: 5 * 60_000, enabled });

export const refreshCalendar = () => {
  queryClient.invalidateQueries({ queryKey: calendarKeys.all });
  invalidateShell();
};

// Availability of a resource for a time, excluding the event being edited.
export const checkAvailability = async ({ resourceId, startDateTime, endDateTime, eventId }) =>
  (await api.get("/api/calendar/resource-availability", { params: { resourceId, startDateTime, endDateTime, eventId: eventId || undefined } })).data;

const FIELD_ERRORS = {
  invalid_dates: "The end must be after the start.",
  duration_too_short: "An event lasts at least 10 minutes.",
  missing_description: "Add a description.",
  missing_location: "Add a location or book a room.",
  missing_destination: "Add the destination of the mission.",
  missing_resource: "Choose what to book.",
};

/**
 * Create or update an event. Resolves to { ok: true, event } or
 * { ok: false, message, conflicts } so the form can show what is in the way.
 */
export async function saveEvent(id, body) {
  try {
    const { data } = id ? await api.put(`/api/calendar/event/${id}`, body) : await api.post("/api/calendar/event", body);
    refreshCalendar();
    return { ok: true, event: data };
  } catch (err) {
    const d = err.response?.data || {};
    return { ok: false, message: FIELD_ERRORS[d.status] || d.message || errorMessage(err), conflicts: d.conflicts || [], status: d.status };
  }
}

export async function deleteEvent(id) {
  try {
    await api.delete(`/api/calendar/event/${id}`);
    showSuccess("Event deleted");
    refreshCalendar();
    return true;
  } catch (err) {
    showError("Could not delete the event", errorMessage(err));
    return false;
  }
}

// HR approves or declines. A clash with a confirmed booking comes back as 409.
export async function reviewEvent(id, status) {
  try {
    await api.put(`/api/calendar/event/${id}/review/${status}`);
    showSuccess(status === "approved" ? "Event approved" : "Event declined");
    refreshCalendar();
    return { ok: true };
  } catch (err) {
    const d = err.response?.data || {};
    const detail = d.conflicts?.length ? `${d.message}: ${d.conflicts.map((c) => `${c.title} (${c.by})`).join(", ")}` : errorMessage(err);
    showError(status === "approved" ? "Could not approve" : "Could not decline", detail);
    return { ok: false, conflicts: d.conflicts || [] };
  }
}

// An invited person accepts or declines.
export async function respondToEvent(id, status) {
  try {
    await api.put(`/api/calendar/event/${id}/respond`, { status });
    showSuccess(status === "accepted" ? "Invitation accepted" : "Invitation declined");
    refreshCalendar();
    return true;
  } catch (err) {
    showError("Could not answer the invitation", errorMessage(err));
    return false;
  }
}
