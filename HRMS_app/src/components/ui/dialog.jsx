import { useEffect, useId, useRef } from "react";
import { X } from "lucide-react";
import { cn } from "../../lib/utils";

/**
 * Modal built on the native <dialog> element: focus stays inside, the page
 * behind is inert, Escape and a click on the scrim call onClose.
 *
 * `side="right"` turns it into a drawer that slides in from the right edge.
 */
export function Dialog({ open, onClose, title, description, children, footer, side, className, labelledBy, hideClose = false }) {
  const ref = useRef(null);
  const titleId = useId();
  const descId = useId();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  // Escape: let React own the open state instead of the browser closing it.
  const onCancel = (event) => {
    event.preventDefault();
    onClose?.();
  };

  // A click on the <dialog> box itself (not its content) is a click on the scrim.
  const onClick = (event) => {
    if (event.target === ref.current) onClose?.();
  };

  const drawer = side === "right";

  return (
    <dialog
      ref={ref}
      onCancel={onCancel}
      onClick={onClick}
      aria-labelledby={labelledBy || (title ? titleId : undefined)}
      aria-describedby={description ? descId : undefined}
      className={cn(
        "m-0 max-h-none max-w-none bg-transparent p-0 text-ink backdrop:bg-scrim",
        drawer ? "ml-auto h-dvh w-full sm:w-[440px]" : "h-dvh w-full"
      )}
    >
      {open && (
        <div className={cn("pointer-events-none flex h-full w-full", drawer ? "" : "items-center justify-center p-4")}>
          <div
            className={cn(
              "pointer-events-auto flex flex-col border border-line-2 bg-raise shadow-pop",
              drawer ? "h-full w-full overflow-y-auto" : "max-h-[calc(100dvh-2rem)] w-full max-w-md overflow-y-auto rounded-2xl",
              className
            )}
          >
            {(title || !hideClose) && (
              <div className="flex items-start gap-3 px-5 pt-5">
                <div className="min-w-0 flex-1">
                  {title && <h2 id={titleId} className="text-lg font-semibold leading-snug">{title}</h2>}
                  {description && <p id={descId} className="mt-1 text-sm text-ink-2">{description}</p>}
                </div>
                {!hideClose && (
                  <button type="button" onClick={onClose} aria-label="Close" className="-mr-2 -mt-1 grid h-10 w-10 place-items-center rounded-md text-ink-3 hover:bg-sunk hover:text-ink">
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            )}
            <div className="px-5 py-4">{children}</div>
            {footer && <div className="mt-auto flex flex-wrap justify-end gap-2 border-t border-line px-5 py-4">{footer}</div>}
          </div>
        </div>
      )}
    </dialog>
  );
}

export function Drawer(props) {
  return <Dialog side="right" {...props} />;
}
