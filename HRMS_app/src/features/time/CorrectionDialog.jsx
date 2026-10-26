import { useEffect, useState } from "react";
import { Dialog } from "../../components/ui/dialog";
import { Button } from "../../components/ui/button";
import { Field, Input, Select, Textarea } from "../../components/ui/field";
import { companyDateTime, formatDay, toDayKey, toTimeInputValue } from "../../lib/dates";
import { requestCorrection } from "./timeApi";

const KINDS = {
  missing_punch_out: "I forgot to punch out",
  missing_punch_in: "I worked but did not punch in",
  wrong_times: "A recorded time is wrong",
};

/**
 * Ask for a punch to be fixed. day: { date, sessions, anomalies } from /mine.
 * The kind starts from the day's exception (missing punch-out, absence...).
 */
export function CorrectionDialog({ day, open, onClose }) {
  const sessions = day?.sessions || [];
  const openSession = sessions.find((s) => !s.checkOut);
  const initialKind = openSession ? "missing_punch_out" : sessions.length ? "wrong_times" : "missing_punch_in";
  const [kind, setKind] = useState(initialKind);
  const [sessionId, setSessionId] = useState("");
  const [times, setTimes] = useState({ in: "", out: "" });
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setKind(initialKind);
    const s = openSession || sessions[0];
    setSessionId(s?.id || "");
    setTimes({ in: toTimeInputValue(s?.checkIn), out: openSession ? "" : toTimeInputValue(s?.checkOut) });
    setReason("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, day]);

  const dayKey = toDayKey(day?.date);
  const kinds = Object.entries(KINDS).filter(([k]) => (k === "missing_punch_out" ? Boolean(openSession) : k === "wrong_times" ? sessions.length > 0 : true));

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    const ok = await requestCorrection({
      date: dayKey,
      kind,
      attendanceId: kind === "missing_punch_in" ? undefined : sessionId,
      checkIn: kind === "missing_punch_out" ? undefined : companyDateTime(dayKey, times.in),
      checkOut: companyDateTime(dayKey, times.out),
      reason: reason.trim(),
    });
    setBusy(false);
    if (ok) onClose();
  };

  return (
    <Dialog open={open} onClose={busy ? undefined : onClose} title="Request a correction" description={day ? formatDay(day.date, { weekday: "long", day: "numeric", month: "long" }) : undefined}>
      <form onSubmit={submit} className="grid gap-3">
        <Field label="What happened">
          <Select value={kind} onChange={(e) => setKind(e.target.value)}>
            {kinds.map(([k, label]) => <option key={k} value={k}>{label}</option>)}
          </Select>
        </Field>
        {kind !== "missing_punch_in" && sessions.length > 1 && (
          <Field label="Session">
            <Select
              value={sessionId}
              onChange={(e) => {
                setSessionId(e.target.value);
                const s = sessions.find((x) => x.id === e.target.value);
                setTimes({ in: toTimeInputValue(s?.checkIn), out: toTimeInputValue(s?.checkOut) });
              }}
            >
              {sessions.map((s) => (
                <option key={s.id} value={s.id}>
                  Session {s.sessionNumber}: {toTimeInputValue(s.checkIn)}–{s.checkOut ? toTimeInputValue(s.checkOut) : "open"}
                </option>
              ))}
            </Select>
          </Field>
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          {kind !== "missing_punch_out" && (
            <Field label="Arrived at" required>
              <Input type="time" value={times.in} onChange={(e) => setTimes((t) => ({ ...t, in: e.target.value }))} />
            </Field>
          )}
          <Field label="Left at" required={kind !== "wrong_times"}>
            <Input type="time" value={times.out} onChange={(e) => setTimes((t) => ({ ...t, out: e.target.value }))} />
          </Field>
        </div>
        <Field label="Reason" required hint="Your approver sees this. e.g. Left for a client site and forgot to punch out.">
          <Textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} />
        </Field>
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button type="submit" disabled={busy || !reason.trim()}>Send request</Button>
        </div>
      </form>
    </Dialog>
  );
}
