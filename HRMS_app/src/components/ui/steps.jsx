import { Fragment } from "react";
import { cn } from "../../lib/utils";

// Stepped progress for multi-step approvals.
// steps: [{ label, state: "done" | "current" | "todo" }]
export function Steps({ steps, className }) {
  const current = steps.findIndex((s) => s.state === "current");
  return (
    <div className={cn("grid gap-1.5", className)}>
      <ol
        className="flex items-center gap-1.5"
        aria-label={current >= 0 ? `Step ${current + 1} of ${steps.length}: ${steps[current].label}` : "Progress"}
      >
        {steps.map((step, i) => (
          <Fragment key={step.label}>
            {i > 0 && <li aria-hidden="true" className={cn("h-0.5 flex-1", steps[i - 1].state === "done" ? "bg-teal" : "bg-line-2")} />}
            <li
              className={cn(
                "h-4 w-4 flex-none rounded-full",
                step.state === "done" && "bg-teal",
                step.state === "current" && "border-2 border-teal",
                step.state === "todo" && "border-2 border-line-2"
              )}
            >
              <span className="sr-only">{`${step.label}: ${step.state}`}</span>
            </li>
          </Fragment>
        ))}
      </ol>
      <div aria-hidden="true" className="flex justify-between gap-2 font-mono text-[10.5px] text-ink-3">
        {steps.map((step) => (
          <span key={step.label} className={step.state === "current" ? "text-teal" : undefined}>
            {step.label}
          </span>
        ))}
      </div>
    </div>
  );
}
