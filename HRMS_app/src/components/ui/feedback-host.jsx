import { useEffect, useState, useSyncExternalStore } from "react";
import { AlertTriangle, Check, Info, X } from "lucide-react";
import { dismissToast, getSnapshot, settleConfirm, subscribe } from "../../lib/feedback";
import { Dialog } from "./dialog";
import { Button } from "./button";
import { cn } from "../../lib/utils";

const TONE = {
  success: { Icon: Check, accent: "text-teal" },
  info: { Icon: Info, accent: "text-teal" },
  warning: { Icon: AlertTriangle, accent: "text-amber" },
  error: { Icon: AlertTriangle, accent: "text-red" },
};

function Toast({ item }) {
  const { Icon, accent } = TONE[item.tone] || TONE.info;
  const [left, setLeft] = useState(Math.ceil(item.duration / 1000));
  const [paused, setPaused] = useState(false);

  // Count down in whole seconds; hovering or focusing the toast pauses it.
  useEffect(() => {
    if (paused) return undefined;
    if (left <= 0) {
      dismissToast(item.id);
      return undefined;
    }
    const timer = setTimeout(() => setLeft((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [left, paused, item.id]);

  return (
    <div
      role={item.tone === "error" ? "alert" : "status"}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      className="pointer-events-auto flex w-full items-start gap-3 rounded-[10px] border border-line-2 bg-raise px-3.5 py-3 text-sm text-ink shadow-pop"
    >
      <Icon className={cn("mt-0.5 h-4 w-4 flex-none", accent)} aria-hidden="true" />
      <div className="min-w-0 flex-1">
        {item.title && <p className="font-semibold leading-snug">{item.title}</p>}
        {item.text && <p className="mt-0.5 whitespace-pre-line text-ink-2">{item.text}</p>}
      </div>
      {item.action && (
        <button
          type="button"
          onClick={() => {
            item.action.onClick?.();
            dismissToast(item.id);
          }}
          className="flex-none rounded px-1 font-semibold text-teal underline underline-offset-2"
        >
          {item.action.label}
        </button>
      )}
      {item.action && <span className="figure flex-none pt-0.5 text-xs text-ink-3">{left}s</span>}
      <button type="button" aria-label="Dismiss" onClick={() => dismissToast(item.id)} className="-m-1 grid h-7 w-7 flex-none place-items-center rounded text-ink-3 hover:bg-sunk hover:text-ink">
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

// Mount once near the root of the app.
export function FeedbackHost() {
  const { toasts, confirm } = useSyncExternalStore(subscribe, getSnapshot);
  return (
    <>
      <div className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-[min(400px,calc(100vw-2rem))] flex-col gap-2">
        {toasts.map((item) => (
          <Toast key={item.id} item={item} />
        ))}
      </div>
      <Dialog
        open={Boolean(confirm)}
        onClose={() => settleConfirm(false)}
        title={confirm?.title}
        description={confirm?.text}
        footer={
          <>
            <Button variant="secondary" onClick={() => settleConfirm(false)}>{confirm?.cancelLabel}</Button>
            <Button variant={confirm?.tone === "danger" ? "danger" : "primary"} onClick={() => settleConfirm(true)} autoFocus>
              {confirm?.confirmLabel}
            </Button>
          </>
        }
      />
    </>
  );
}
