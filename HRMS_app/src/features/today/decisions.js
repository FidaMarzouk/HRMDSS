import { useSyncExternalStore } from "react";
import { deferRequest, UNDO_WINDOW_MS } from "../../lib/deferred";
import { toast } from "../../lib/feedback";
import { showError } from "../../lib/alerts";
import { errorMessage } from "../../lib/api";
import { invalidateShell } from "../../lib/queries";

// Approvals from the Today queue and the command palette share this store, so
// both show the same "approving, undo available" state.
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

const describe = (item) => (item.kind === "leave" ? "Leave approved" : "Event approved");

/**
 * Approve a queue item ({ id, kind, title, approve: { method, url } }).
 * The request is sent after the undo window; Undo cancels it.
 */
export function approveItem(item) {
  if (pendingIds.has(item.id)) return;
  emit(new Set(pendingIds).add(item.id));

  const settle = () => {
    const next = new Set(pendingIds);
    next.delete(item.id);
    emit(next);
  };

  const { undo } = deferRequest({
    key: `approve:${item.id}`,
    request: item.approve,
    onDone: () => {
      settle();
      invalidateShell();
    },
    onError: (error) => {
      settle();
      showError("Could not approve", errorMessage(error));
      invalidateShell();
    },
  });

  toast({
    tone: "success",
    title: describe(item),
    text: `${item.title}. Sent when the timer ends.`,
    duration: UNDO_WINDOW_MS,
    action: {
      label: "Undo",
      onClick: () => {
        undo();
        settle();
      },
    },
  });
}
