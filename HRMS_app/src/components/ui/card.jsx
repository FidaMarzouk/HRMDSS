import { cn } from "../../lib/utils";

// Panels: 1px hairline, radius 12, no drop shadow. `raised` for nested surfaces.
export function Card({ className, raised = false, children, ...props }) {
  return (
    <div className={cn("min-w-0 rounded-xl border border-line text-ink", raised ? "bg-raise" : "bg-panel", className)} {...props}>
      {children}
    </div>
  );
}

export function CardHeader({ className, children, ...props }) {
  return (
    <div className={cn("flex flex-col gap-1 p-4 sm:p-5", className)} {...props}>
      {children}
    </div>
  );
}

export function CardTitle({ className, as: Tag = "h3", children, ...props }) {
  return (
    <Tag className={cn("text-base font-semibold leading-tight", className)} {...props}>
      {children}
    </Tag>
  );
}

export function CardContent({ className, children, ...props }) {
  return (
    <div className={cn("p-4 pt-0 sm:p-5 sm:pt-0", className)} {...props}>
      {children}
    </div>
  );
}
