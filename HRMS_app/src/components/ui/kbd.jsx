import { cn } from "../../lib/utils";

export function Kbd({ className, children }) {
  return <kbd className={cn("rounded border border-line-2 px-1.5 py-px font-mono text-[10px] text-ink-3", className)}>{children}</kbd>;
}
