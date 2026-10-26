import { cn } from "../../lib/utils";

const TONE = {
  ok: { mark: "✓", cls: "text-teal", label: "Passes" },
  warn: { mark: "!", cls: "text-amber", label: "Warning" },
  fail: { mark: "!", cls: "text-red", label: "Fails" },
  info: { mark: "·", cls: "text-ink-3", label: "Note" },
};

// Policy checks (notice, balance, coverage), each with a mark and a reason.
export function PolicyChecks({ checks = [], suggestion, formatRange }) {
  return (
    <ul className="grid gap-1.5">
      {checks.map((c) => {
        const tone = TONE[c.tone] || TONE.info;
        return (
          <li key={c.id} className="grid grid-cols-[16px_1fr] gap-2 text-[13px] leading-snug">
            <b aria-label={tone.label} className={cn("font-mono", tone.cls)}>{tone.mark}</b>
            <span>{c.text}</span>
          </li>
        );
      })}
      {suggestion && (
        <li className="grid grid-cols-[16px_1fr] gap-2 text-[13px] leading-snug">
          <b aria-hidden="true" className="font-mono text-ink-3">·</b>
          <span className="text-ink-2">
            Suggested: {formatRange(suggestion.startDate, suggestion.endDate)}, same length ({suggestion.workingDays} working days), within the team limit
          </span>
        </li>
      )}
    </ul>
  );
}
