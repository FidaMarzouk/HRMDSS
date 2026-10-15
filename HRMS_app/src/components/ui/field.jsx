import { cloneElement, forwardRef, isValidElement, useId } from "react";
import { cn } from "../../lib/utils";

// Shared look for text inputs, selects and textareas. Borders use the `edge`
// token, which keeps a 3:1 contrast against every surface in both themes.
export const controlClass =
  "w-full rounded-lg border border-edge bg-panel px-3 text-sm text-ink placeholder:text-ink-3 transition-colors hover:border-ink-3 focus:border-teal focus:outline-none focus:ring-2 focus:ring-teal/25 disabled:cursor-not-allowed disabled:bg-sunk disabled:text-ink-3 aria-[invalid=true]:border-red";

export const Input = forwardRef(({ className, ...props }, ref) => (
  <input ref={ref} className={cn(controlClass, "h-10", className)} {...props} />
));
Input.displayName = "Input";

export const Select = forwardRef(({ className, children, ...props }, ref) => (
  <select ref={ref} className={cn(controlClass, "h-10 pr-8", className)} {...props}>
    {children}
  </select>
));
Select.displayName = "Select";

export const Textarea = forwardRef(({ className, rows = 3, ...props }, ref) => (
  <textarea ref={ref} rows={rows} className={cn(controlClass, "py-2.5 leading-relaxed", className)} {...props} />
));
Textarea.displayName = "Textarea";

// Label, hint and error wired to a single control child with ids and aria attributes.
export function Field({ label, hint, error, required, className, children }) {
  const generatedId = useId();
  const controlId = (isValidElement(children) && children.props.id) || generatedId;
  const hintId = hint ? `${controlId}-hint` : undefined;
  const errorId = error ? `${controlId}-error` : undefined;
  const control = isValidElement(children)
    ? cloneElement(children, {
        id: controlId,
        "aria-invalid": error ? true : undefined,
        "aria-describedby": [errorId, hintId].filter(Boolean).join(" ") || undefined,
        required: children.props.required ?? required,
      })
    : children;

  return (
    <div className={cn("grid gap-1.5", className)}>
      {label && (
        <label htmlFor={controlId} className="text-xs font-medium text-ink-2">
          {label}
          {required && <span className="text-red" aria-hidden="true"> *</span>}
        </label>
      )}
      {control}
      {error ? <p id={errorId} className="text-xs text-red">{error}</p> : hint && <p id={hintId} className="text-xs text-ink-3">{hint}</p>}
    </div>
  );
}
