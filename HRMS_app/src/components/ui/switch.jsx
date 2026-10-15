import { cn } from "../../lib/utils";

export function Switch({ checked, onChange, label, className, disabled, ...props }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={Boolean(checked)}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange?.(!checked)}
      className={cn("relative h-6 w-[42px] flex-none rounded-full transition-colors disabled:opacity-50", checked ? "bg-teal" : "bg-edge", className)}
      {...props}
    >
      <span
        aria-hidden="true"
        className={cn("absolute top-[3px] h-[18px] w-[18px] rounded-full bg-panel transition-[left]", checked ? "left-[21px]" : "left-[3px]")}
      />
    </button>
  );
}
