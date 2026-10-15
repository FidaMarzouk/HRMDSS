// Toasts and confirmation dialogs, callable from anywhere (event handlers,
// hooks, plain modules). Rendered by <FeedbackHost /> in App.jsx.
//
//   toast({ title, text, tone, action: { label, onClick }, duration })
//   await confirm({ title, text, confirmLabel, cancelLabel, tone }) -> true | false

const DEFAULT_DURATION = { success: 4000, info: 5000, warning: 7000, error: 8000 };

let state = { toasts: [], confirm: null };
const listeners = new Set();
let nextId = 1;

const emit = (next) => {
  state = next;
  listeners.forEach((listener) => listener());
};

export const subscribe = (listener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const getSnapshot = () => state;

export const dismissToast = (id) => emit({ ...state, toasts: state.toasts.filter((t) => t.id !== id) });

export const toast = ({ title, text, tone = "success", action, duration } = {}) => {
  const id = nextId++;
  const item = { id, title, text, tone, action, duration: duration ?? DEFAULT_DURATION[tone] ?? 5000 };
  // Keep the newest three so a burst of errors cannot cover the page.
  emit({ ...state, toasts: [...state.toasts, item].slice(-3) });
  return id;
};

export const confirm = ({ title, text, confirmLabel = "Confirm", cancelLabel = "Cancel", tone = "default" } = {}) =>
  new Promise((resolve) => {
    // A second confirm replaces the first, which counts as cancelled.
    state.confirm?.resolve(false);
    emit({ ...state, confirm: { title, text, confirmLabel, cancelLabel, tone, resolve } });
  });

export const settleConfirm = (result) => {
  state.confirm?.resolve(result);
  emit({ ...state, confirm: null });
};
