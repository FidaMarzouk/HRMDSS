import { useSyncExternalStore } from "react";
import api, { errorMessage } from "../../lib/api";
import { deferRequest, UNDO_WINDOW_MS } from "../../lib/deferred";
import { toast } from "../../lib/feedback";
import { showError, showSuccess } from "../../lib/alerts";
import { invalidateShell, queryClient } from "../../lib/queries";

// Approvals from the Today queue and the command palette share this store, so
// both show the same "approved, undo available" state.
let pendingIds = new Set();
const listeners = new Set();
const emit = (next) => {
  pendingIds = next;
  listeners.forEach((l) => l());
};
const subscribe = (l) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

export const usePendingDecisions = () => useSyncExternalStore(subscribe, () => pendingIds);

const mark = (id) => emit(new Set(pendingIds).add(id));
const settle = (id) => {
  const next = new Set(pendingIds);
  next.delete(id);
  emit(next);
};

const refresh = () => {
  invalidateShell();
  queryClient.invalidateQueries({ queryKey: ["leave"] });
};

// Leave: the server applies the decision at once and holds the notification
// for its undo window; Undo calls POST /:id/undo (works from any device).
async function approveLeave(item) {
  mark(item.id);
  try {
    await api.request({ method: item.approve.method, url: item.approve.url });
  } catch (error) {
    settle(item.id);
    showError("Could not approve", errorMessage(error));
    refresh();
    return;
  }
  refresh();
  const timer = setTimeout(() => settle(item.id), UNDO_WINDOW_MS);
  toast({
    tone: "success",
    title: "Leave approved",
    text: `${item.title}. Notified when the timer ends.`,
    duration: UNDO_WINDOW_MS,
    action: {
      label: "Undo",
      onClick: async () => {
        clearTimeout(timer);
        try {
          await api.post(`/api/leave-requests/${item.id}/undo`);
          showSuccess("Approval undone", "Nothing was sent.");
        } catch (error) {
          showError("Could not undo", errorMessage(error));
        }
        settle(item.id);
        refresh();
      },
    },
  });
}

// Events and attendance corrections have no server-side undo: the request is
// sent only after the window unless Undo is pressed.
const DEFERRED_TITLE = { event: "Event approved", correction: "Correction approved" };
function approveDeferred(item) {
  mark(item.id);
  const { undo } = deferRequest({
    key: `approve:${item.id}`,
    request: item.approve,
    onDone: () => {
      settle(item.id);
      refresh();
    },
    onError: (error) => {
      settle(item.id);
      showError("Could not approve", errorMessage(error));
      refresh();
    },
  });
  toast({
    tone: "success",
    title: DEFERRED_TITLE[item.kind] || "Approved",
    text: `${item.title}. Sent when the timer ends.`,
    duration: UNDO_WINDOW_MS,
    action: {
      label: "Undo",
      onClick: () => {
        undo();
        settle(item.id);
      },
    },
  });
}

/** Approve a queue item ({ id, kind, title, approve: { method, url } }). */
export function approveItem(item) {
  if (pendingIds.has(item.id)) return;
  if (item.kind === "leave") approveLeave(item);
  else approveDeferred(item);
}
