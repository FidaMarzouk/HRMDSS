import { useQuery } from "@tanstack/react-query";
import api, { errorMessage } from "../../lib/api";
import { invalidateShell, queryClient } from "../../lib/queries";
import { toast } from "../../lib/feedback";
import { showError, showSuccess } from "../../lib/alerts";

// Server-side undo window shown to the user (the server allows 2 s more for latency).
export const UNDO_SECONDS = 8;

export const leaveKeys = {
  all: ["leave"],
  list: ["leave", "list"],
  context: (id) => ["leave", "context", id],
};

export const useLeaveList = () =>
  useQuery({ queryKey: leaveKeys.list, queryFn: async () => (await api.get("/api/leave-requests")).data });

export const useLeaveContext = (id) =>
  useQuery({
    queryKey: leaveKeys.context(id),
    queryFn: async () => (await api.get(`/api/leave-requests/${id}/context`)).data,
    enabled: Boolean(id),
  });

export const refreshLeave = () => {
  queryClient.invalidateQueries({ queryKey: leaveKeys.all });
  invalidateShell();
};

const fullName = (u) => (u ? `${u.firstName || ""} ${u.lastName || ""}`.trim() : "");

const undoDecision = async (id) => {
  try {
    await api.post(`/api/leave-requests/${id}/undo`);
    showSuccess("Decision undone", "Nothing was sent to the employee.");
  } catch (err) {
    showError("Could not undo", errorMessage(err));
  }
  refreshLeave();
};

/**
 * Approve or reject. The server applies it at once and holds notifications for
 * the undo window; the toast's Undo calls POST /:id/undo.
 * request: { _id, employeeId, ... }; reviewPath: "manager" | "admin" | "superadmin"
 */
export async function decideLeave({ request, reviewPath, action, note }) {
  try {
    await api.put(`/api/leave-requests/${reviewPath}/${request._id}/${action}`, note ? { note } : {});
  } catch (err) {
    showError(action === "approve" ? "Could not approve" : "Could not reject", errorMessage(err));
    refreshLeave();
    return false;
  }
  refreshLeave();
  const who = fullName(request.employeeId);
  toast({
    tone: action === "approve" ? "success" : "info",
    title: action === "approve" ? "Leave approved" : "Leave rejected",
    text: `${who ? `${who}. ` : ""}They are notified when the timer ends.`,
    duration: UNDO_SECONDS * 1000,
    action: { label: "Undo", onClick: () => undoDecision(request._id) },
  });
  return true;
}

export async function proposeDates({ request, startDate, endDate, note }) {
  try {
    await api.post(`/api/leave-requests/${request._id}/counter-propose`, { startDate, endDate, note });
    showSuccess("New dates proposed", `${fullName(request.employeeId) || "The employee"} can accept them in one click.`);
    refreshLeave();
    return true;
  } catch (err) {
    showError("Could not propose dates", errorMessage(err));
    return false;
  }
}

export async function answerProposal({ request, accept }) {
  try {
    const { data } = await api.post(`/api/leave-requests/${request._id}/counter-proposal/${accept ? "accept" : "decline"}`);
    showSuccess(accept ? "New dates accepted" : "Proposal declined", accept ? `Your request is now "${data.request.status}".` : "Your original request goes back to the reviewer.");
    refreshLeave();
    return true;
  } catch (err) {
    showError("Could not answer the proposal", errorMessage(err));
    return false;
  }
}
