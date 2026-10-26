import api, { API_URL } from "./api";

// Undo instead of "Are you sure?": a decision is sent only after this window,
// unless the user presses Undo. Business rule, see the concept board.
export const UNDO_WINDOW_MS = 8000;

const pending = new Map();

/**
 * Schedule `request` ({ method, url, data }) to be sent after the undo window.
 * Returns { undo }. If the page is closed during the window the request is
 * still sent (fetch with keepalive), so a decision is never silently lost.
 */
export function deferRequest({ key, request, delay = UNDO_WINDOW_MS, onDone, onError }) {
  pending.get(key)?.cancel();

  const send = async () => {
    pending.delete(key);
    try {
      const { data } = await api.request({ method: request.method, url: request.url, data: request.data });
      onDone?.(data);
    } catch (error) {
      onError?.(error);
    }
  };

  const timer = setTimeout(send, delay);
  const entry = {
    request,
    cancel: () => {
      clearTimeout(timer);
      pending.delete(key);
    },
  };
  pending.set(key, entry);
  return { undo: entry.cancel };
}

export const isPending = (key) => pending.has(key);

// Send whatever is still waiting when the tab is hidden for good.
if (typeof window !== "undefined") {
  window.addEventListener("pagehide", () => {
    pending.forEach(({ request }) => {
      fetch(`${API_URL}${request.url}`, {
        method: request.method.toUpperCase(),
        credentials: "include",
        keepalive: true,
        headers: request.data ? { "Content-Type": "application/json" } : undefined,
        body: request.data ? JSON.stringify(request.data) : undefined,
      });
    });
    pending.clear();
  });
}
