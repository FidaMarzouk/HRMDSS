import { confirm, toast } from "./feedback";

// Short helpers used across pages. Messages appear as toasts; confirmations as
// an in-app dialog (see lib/feedback.js and components/ui/feedback-host.jsx).

export const showSuccess = (title, text) => toast({ tone: "success", title, text });

export const showError = (title, text) => toast({ tone: "error", title, text });

export const showWarning = (title, text) => toast({ tone: "warning", title, text });

export const showInfo = (title, text) => toast({ tone: "info", title, text });

// Resolves to true when the user confirms. Pass tone: "danger" for destructive actions.
export const confirmAction = (title, text, confirmLabel = "Confirm", { cancelLabel, tone = "danger" } = {}) =>
  confirm({ title, text, confirmLabel, cancelLabel, tone });
