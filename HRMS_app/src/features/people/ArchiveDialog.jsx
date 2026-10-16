import { useEffect, useState } from "react";
import { Dialog } from "../../components/ui/dialog";
import { Button } from "../../components/ui/button";
import { Field, Input, Textarea } from "../../components/ui/field";
import { archivePerson } from "./peopleApi";
import { fullName } from "./peopleUtils";

// Archive instead of delete: says exactly what happens and asks for the name.
export function ArchiveDialog({ person, open, onClose, onArchived }) {
  const [typed, setTyped] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const name = fullName(person);

  useEffect(() => {
    if (open) {
      setTyped("");
      setReason("");
    }
  }, [open]);

  const matches = typed.trim().toLowerCase() === name.toLowerCase();

  const submit = async (e) => {
    e.preventDefault();
    if (!matches) return;
    setBusy(true);
    const ok = await archivePerson(person.id, { confirmName: typed, reason: reason.trim() || undefined });
    setBusy(false);
    if (ok) onArchived?.();
  };

  return (
    <Dialog open={open} onClose={busy ? undefined : onClose} title={`Archive ${name}?`}>
      <form onSubmit={submit} className="grid gap-3">
        <ul className="grid gap-1 text-[13px] text-ink-2">
          <li>· They can no longer sign in; an open session ends now.</li>
          <li>· Leave requests still in progress are closed.</li>
          <li>· They leave lists, team counts and the floor view.</li>
          <li>· Their attendance, leave and history are kept. HR can restore them.</li>
        </ul>
        <Field label="Reason (kept in the history)">
          <Textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} placeholder="e.g. End of contract, 31 Oct 2026" />
        </Field>
        <Field label={`Type ${name} to confirm`}>
          <Input value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" />
        </Field>
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button type="submit" variant="danger" disabled={!matches || busy}>Archive {person?.firstName}</Button>
        </div>
      </form>
    </Dialog>
  );
}
