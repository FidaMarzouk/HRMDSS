import { useEffect, useRef } from "react";
import { cn } from "../../lib/utils";
import { buttonVariants } from "./button";

// Composable modal kept for existing screens (leave form, decisions, employee
// details, logout). Built on the native <dialog> element like ./dialog.jsx.
export function AlertDialog({ open, onOpenChange, children }) {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onCancel={(e) => {
        e.preventDefault();
        onOpenChange?.(false);
      }}
      onClick={(e) => {
        if (e.target === ref.current) onOpenChange?.(false);
      }}
      className="m-0 h-dvh max-h-none w-full max-w-none bg-transparent p-0 text-ink backdrop:bg-scrim"
    >
      {open && <div className="pointer-events-none flex h-full w-full items-center justify-center p-4">{children}</div>}
    </dialog>
  );
}

export function AlertDialogContent({ className, children, ...props }) {
  return (
    <div
      className={cn(
        "pointer-events-auto relative max-h-[calc(100dvh-2rem)] w-full max-w-md overflow-y-auto rounded-2xl border border-line-2 bg-raise text-ink shadow-pop",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function AlertDialogHeader({ className, children, ...props }) {
  return (
    <div className={cn("p-5", className)} {...props}>
      {children}
    </div>
  );
}

export function AlertDialogTitle({ className, children, ...props }) {
  return (
    <h2 className={cn("text-lg font-semibold", className)} {...props}>
      {children}
    </h2>
  );
}

export function AlertDialogDescription({ className, children, ...props }) {
  return (
    <div className={cn("text-sm text-ink-2", className)} {...props}>
      {children}
    </div>
  );
}

export function AlertDialogFooter({ className, children, ...props }) {
  return (
    <div className={cn("flex flex-col-reverse justify-end gap-2 p-5 pt-0 sm:flex-row", className)} {...props}>
      {children}
    </div>
  );
}

export function AlertDialogCancel({ className, onClick, children, ...props }) {
  return (
    <button type="button" className={cn(buttonVariants({ variant: "secondary" }), className)} onClick={onClick} {...props}>
      {children}
    </button>
  );
}

export function AlertDialogAction({ className, onClick, children, ...props }) {
  return (
    <button
      type="button"
      className={cn(buttonVariants({ variant: "primary" }), className)}
      onClick={(e) => {
        e.stopPropagation();
        onClick?.(e);
      }}
      {...props}
    >
      {children}
    </button>
  );
}
