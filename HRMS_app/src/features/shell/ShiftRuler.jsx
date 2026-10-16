import { useEffect, useState } from "react";
import { useTodaySessions } from "../../lib/queries";
import { formatClock } from "../time/sessions";

const START = 7 * 60; // 07:00
const SPAN = 12 * 60; // to 19:00
const LABELS = ["07", "10", "13", "16", "19"];

const pct = (date) => {
  const d = new Date(date);
  const m = d.getHours() * 60 + d.getMinutes();
  return Math.max(0, Math.min(100, ((m - START) / SPAN) * 100));
};

// Calibrated ruler for the working day: hour and quarter ticks, today's worked
// spans in teal, and a needle at the current time.
export function ShiftRuler({ className }) {
  const [now, setNow] = useState(() => new Date());
  const { data: sessions } = useTodaySessions();

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(timer);
  }, []);

  const spans = (sessions || [])
    .filter((s) => s.checkIn)
    .map((s) => ({ id: s._id, from: pct(s.checkIn), to: pct(s.checkOut || now) }));

  return (
    <div className={className} aria-hidden="true">
      <div className="relative h-[30px]">
        <div
          className="absolute inset-x-0 bottom-2 h-3.5 border-b border-line-2"
          style={{
            background:
              "repeating-linear-gradient(90deg, rgb(var(--line-2)) 0 1px, transparent 1px calc(100% / 48)) bottom / 100% 6px no-repeat," +
              "repeating-linear-gradient(90deg, rgb(var(--line-2)) 0 1px, transparent 1px calc(100% / 12)) bottom / 100% 14px no-repeat",
          }}
        />
        {spans.map((s) => (
          <span key={s.id} className="absolute bottom-2 h-[3px] rounded-sm bg-teal" style={{ left: `${s.from}%`, width: `${Math.max(0.5, s.to - s.from)}%` }} />
        ))}
        {LABELS.map((l, i) => (
          <span key={l} className="absolute -bottom-1 -translate-x-1/2 font-mono text-[9px] text-ink-3" style={{ left: `${i * 25}%` }}>
            {l}
          </span>
        ))}
        <span className="absolute bottom-0 h-[30px] w-0.5 bg-teal transition-[left] duration-1000" style={{ left: `${pct(now)}%` }}>
          <span className="absolute -top-0.5 left-1.5 whitespace-nowrap font-mono text-[10px] text-teal">{formatClock(now)}</span>
        </span>
      </div>
    </div>
  );
}
