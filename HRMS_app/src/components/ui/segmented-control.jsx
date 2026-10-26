import { cn } from "../../lib/utils";

// options: [{ value, label }]. Pressed-state buttons inside a sunk track.
export function SegmentedControl({ options, value, onChange, label, className, size = "md" }) {
  return (
    <div role="group" aria-label={label} className={cn("inline-flex flex-wrap rounded-lg border border-line bg-sunk p-[3px]", className)}>
      {options.map((option) => {
        const pressed = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={pressed}
            onClick={() => onChange?.(option.value)}
            className={cn(
              "rounded-md px-3 text-[13px] transition-colors",
              size === "sm" ? "h-7" : "h-8",
              pressed ? "bg-panel font-semibold text-ink shadow-[0_1px_0_rgb(var(--line-2))]" : "text-ink-2 hover:text-ink"
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
