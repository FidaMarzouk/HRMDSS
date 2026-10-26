import { useEffect, useId, useRef, useState } from "react";
import { CalendarRange } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/field";
import { Switch } from "../../components/ui/switch";
import { toDayKey } from "../../lib/dates";
import { cn } from "../../lib/utils";
import { PRESETS, daysIn, describeRange, presetOf, presetRange } from "./period";

const MAX_DAYS = 366;

/**
 * "15 Sep → 15 Oct vs prev." pill. Opens presets, a custom range and the
 * compare-to-previous switch. value: { from, to }, compare: boolean.
 */
export function PeriodPicker({ value, onChange, compare, onCompareChange, showCompare = true }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value);
  const panelId = useId();
  const buttonRef = useRef(null);
  const panelRef = useRef(null);
  const active = presetOf(value);
  const today = toDayKey(new Date());

  useEffect(() => {
    if (!open) return undefined;
    setDraft(value);
    const onPointer = (e) => {
      if (!panelRef.current?.contains(e.target) && !buttonRef.current?.contains(e.target)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointer);
    return () => document.removeEventListener("pointerdown", onPointer);
  }, [open, value]);

  const close = () => {
    setOpen(false);
    buttonRef.current?.focus();
  };
  const pick = (range) => {
    onChange(range);
    close();
  };

  const draftError = !draft.from || !draft.to ? "Choose both dates." : draft.from > draft.to ? "The start must be before the end." : daysIn(draft) > MAX_DAYS ? "Choose at most one year." : "";

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex h-10 items-center gap-2 rounded-full border border-edge bg-panel px-3.5 text-[13px] text-ink hover:border-teal"
      >
        <CalendarRange className="h-4 w-4 text-teal" aria-hidden />
        <span className="figure">{describeRange(value)}</span>
        {showCompare && compare && <span className="text-ink-3">vs prev.</span>}
      </button>
      {open && (
        <div
          ref={panelRef}
          id={panelId}
          role="dialog"
          aria-label="Choose a period"
          onKeyDown={(e) => e.key === "Escape" && close()}
          className="absolute right-0 z-40 mt-1 grid w-[300px] gap-3 rounded-[10px] border border-line-2 bg-raise p-3 shadow-pop"
        >
          <div className="grid gap-1" role="group" aria-label="Presets">
            {PRESETS.map((p) => (
              <button
                key={p.value}
                type="button"
                aria-pressed={active === p.value}
                onClick={() => pick(presetRange(p.value, today))}
                className={cn("flex h-9 items-center justify-between rounded-md px-2.5 text-left text-[13px] hover:bg-sunk", active === p.value ? "font-semibold text-ink" : "text-ink-2")}
              >
                {p.label}
                <span className="figure text-[11px] text-ink-3">{describeRange(presetRange(p.value, today))}</span>
              </button>
            ))}
          </div>
          <form
            className="grid gap-2 border-t border-line pt-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (!draftError) pick(draft);
            }}
          >
            <p className="label-key">Custom</p>
            <div className="grid grid-cols-2 gap-2">
              <label className="grid gap-1 text-[11.5px] text-ink-3">
                From
                <Input type="date" value={draft.from} max={today} onChange={(e) => setDraft((d) => ({ ...d, from: e.target.value }))} className="h-9 px-2 text-[13px]" />
              </label>
              <label className="grid gap-1 text-[11.5px] text-ink-3">
                To
                <Input type="date" value={draft.to} onChange={(e) => setDraft((d) => ({ ...d, to: e.target.value }))} className="h-9 px-2 text-[13px]" />
              </label>
            </div>
            {draftError && draft.from && draft.to && <p className="text-[12px] text-red">{draftError}</p>}
            <Button type="submit" variant="secondary" size="sm" disabled={Boolean(draftError)}>
              Apply range
            </Button>
          </form>
          {showCompare && (
            <div className="flex items-center justify-between gap-3 border-t border-line pt-3 text-[13px] text-ink-2">
              <span aria-hidden="true">Compare with the previous period</span>
              <Switch checked={compare} onChange={onCompareChange} label="Compare with the previous period" />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
