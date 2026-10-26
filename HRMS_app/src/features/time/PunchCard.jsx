import { useEffect, useState } from "react";
import { Coffee, LogIn, LogOut, Play } from "lucide-react";
import { Button } from "../../components/ui/button";
import { StatusPill } from "../../components/ui/status-pill";
import { ShiftRing } from "../../components/marks/ShiftRing";
import { useTodaySessions } from "../../lib/queries";
import { formatClock, formatDuration, summarizeSessions } from "./sessions";
import { punch } from "./timeApi";

const EXPECTED_MINUTES = 8 * 60 + 30; // 08:00-18:00 minus the 12:30-14:00 lunch
const LUNCH = { start: 12 * 60 + 30, end: 14 * 60 };
const minutesOfDay = (d) => d.getHours() * 60 + d.getMinutes();

// When the day's work is complete: remaining work, plus the lunch window if
// no break has been taken yet and it is not over.
const expectedPunchOut = (shift, now) => {
  const remaining = Math.max(0, EXPECTED_MINUTES - shift.workedMinutes);
  const m = minutesOfDay(now);
  const lunchLeft = shift.breakMinutes === 0 && m < LUNCH.end ? LUNCH.end - Math.max(m, LUNCH.start) : 0;
  return new Date(now.getTime() + (remaining + lunchLeft) * 60000);
};

/**
 * Punch card: the shift ring, a live clock, the status, and only the next
 * sensible action as the primary button.
 */
export function PunchCard() {
  const { data, isLoading } = useTodaySessions();
  const [now, setNow] = useState(() => new Date());
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const shift = summarizeSessions(data || [], now);
  const m = minutesOfDay(now);
  const inLunch = m >= LUNCH.start && m <= LUNCH.end;
  const left = Math.max(0, EXPECTED_MINUTES - shift.workedMinutes);
  const run = (path, title) => async () => {
    setBusy(true);
    await punch(path, title);
    setBusy(false);
  };

  const status = {
    out: <StatusPill status="neutral">Not punched in</StatusPill>,
    in: <StatusPill status={shift.late ? "late" : "present"}>{shift.late ? `Late +${shift.lateBy}m · ` : ""}Working since {formatClock(shift.since)}</StatusPill>,
    break: <StatusPill status="pending">On break since {formatClock(shift.breakSince)}</StatusPill>,
    left: <StatusPill status="neutral">Punched out at {formatClock(shift.lastOut)}</StatusPill>,
  }[shift.state];

  return (
    <section aria-label="Punch card" className="flex flex-wrap items-center gap-6 rounded-xl border border-line bg-panel p-5">
      <ShiftRing
        workedMinutes={shift.workedMinutes}
        breakMinutes={shift.breakMinutes}
        expectedMinutes={EXPECTED_MINUTES}
        label={`${formatDuration(shift.workedMinutes)} worked of ${formatDuration(EXPECTED_MINUTES)}, ${formatDuration(shift.breakMinutes)} break`}
      >
        <div>
          <b className="figure block text-3xl font-medium leading-none">{formatDuration(shift.workedMinutes)}</b>
          <span className="text-xs text-ink-3">of {formatDuration(EXPECTED_MINUTES)} · {formatDuration(left)} left</span>
        </div>
      </ShiftRing>

      <div className="grid min-w-[220px] flex-1 gap-2.5">
        {!isLoading && <div>{status}</div>}
        <p className="figure text-[40px] leading-none" aria-live="off">
          {now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
          <span className="text-lg text-ink-3">:{String(now.getSeconds()).padStart(2, "0")}</span>
        </p>
        <p className="text-xs text-ink-2">
          {now.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}
          {(shift.state === "in" || shift.state === "break") && ` · expected punch-out ≈ ${formatClock(expectedPunchOut(shift, now))}`}
        </p>
        <div className="flex flex-wrap gap-2">
          {(shift.state === "out" || shift.state === "left") && (
            <Button onClick={run("/api/attendance/punch-in", "Punched in")} disabled={busy || isLoading}>
              <LogIn /> {shift.state === "left" ? "Punch in again" : "Punch in"}
            </Button>
          )}
          {shift.state === "in" && (
            <>
              <Button variant="secondary" onClick={run("/api/attendance/break/start", "Break started")} disabled={busy || !inLunch} title={inLunch ? undefined : "Lunch break can start between 12:30 and 14:00"}>
                <Coffee /> Start break
              </Button>
              <Button onClick={run("/api/attendance/punch-out", "Punched out")} disabled={busy}>
                <LogOut /> Punch out
              </Button>
            </>
          )}
          {shift.state === "break" && (
            <>
              <Button onClick={run("/api/attendance/break/end", "Break ended")} disabled={busy}>
                <Play /> End break
              </Button>
              <Button variant="secondary" onClick={run("/api/attendance/punch-out", "Punched out")} disabled={busy}>
                <LogOut /> Punch out
              </Button>
            </>
          )}
        </div>
        {shift.state === "in" && !inLunch && <p className="text-[11px] text-ink-3">Lunch break can start between 12:30 and 14:00.</p>}
        {shift.source && <p className="font-mono text-[10.5px] uppercase tracking-[0.08em] text-ink-3">Last punch: {shift.source === "mobile" ? "mobile" : shift.source === "correction" ? "correction" : "web"}</p>}
      </div>
    </section>
  );
}
