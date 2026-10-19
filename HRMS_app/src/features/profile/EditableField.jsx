import { useEffect, useId, useRef, useState } from "react";
import { Lock, Pencil } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/field";
import { cn } from "../../lib/utils";

/**
 * A field shown as its value, with a pencil to edit only that field.
 * `readOnly` fields say who can change them instead.
 * validate(value) returns an error message or "".
 */
export function EditableField({ label, value, display, type = "text", placeholder, validate, onSave, readOnly, readOnlyNote, inputProps }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? "");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const inputRef = useRef(null);
  const id = useId();

  useEffect(() => {
    if (!editing) setDraft(value ?? "");
  }, [value, editing]);
  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const save = async (e) => {
    e.preventDefault();
    const next = typeof draft === "string" ? draft.trim() : draft;
    const problem = validate ? validate(next) : "";
    if (problem) {
      setError(problem);
      return;
    }
    if (next === (value ?? "")) {
      setEditing(false);
      return;
    }
    setSaving(true);
    const ok = await onSave(next);
    setSaving(false);
    if (ok) {
      setEditing(false);
      setError("");
    }
  };

  const shown = display ?? value;
  return (
    <div className="grid grid-cols-[minmax(0,140px)_minmax(0,1fr)] items-start gap-3 border-t border-line py-2.5 first:border-t-0 max-sm:grid-cols-1 max-sm:gap-1">
      <label htmlFor={id} className="pt-1.5 text-[12.5px] text-ink-3">{label}</label>
      {editing ? (
        <form onSubmit={save} className="grid gap-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <Input
              id={id}
              ref={inputRef}
              type={type}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => e.key === "Escape" && setEditing(false)}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? `${id}-error` : undefined}
              placeholder={placeholder}
              className="h-9 max-w-xs flex-1 text-[13px]"
              {...inputProps}
            />
            <Button type="submit" size="sm" disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(false)}>Cancel</Button>
          </div>
          {error && <p id={`${id}-error`} className="text-[12px] text-red">{error}</p>}
        </form>
      ) : (
        <div className="flex min-w-0 items-center justify-between gap-2">
          <span id={id} className={cn("min-w-0 truncate pt-1 text-[13.5px]", shown ? "text-ink" : "text-ink-3")}>{shown || "Not set"}</span>
          {readOnly ? (
            <span className="flex flex-none items-center gap-1 text-[11.5px] text-ink-3" title={readOnlyNote}>
              <Lock className="h-3.5 w-3.5" aria-hidden /> {readOnlyNote}
            </span>
          ) : (
            <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(true)} aria-label={`Edit ${label.toLowerCase()}`}>
              <Pencil aria-hidden /> {shown ? "Edit" : "Add"}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
