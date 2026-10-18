// Reading today's attendance sessions (GET /api/attendance/today).

export const formatClock = (date) =>
  date ? new Date(date).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) : "";

// "5:39" from minutes
export const formatDuration = (minutes) => {
  const m = Math.max(0, Math.round(minutes));
  return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, "0")}`;
};

/**
 * { state, since, lastOut, workedMinutes, late }
 * state: "out" (not punched in today), "in", "break", "left" (all sessions closed)
 * workedMinutes excludes breaks and counts open sessions up to `now`;
 * breakMinutes is today's total break time.
 */
export function summarizeSessions(sessions = [], now = new Date()) {
  const worked = sessions.filter((s) => s.checkIn).sort((a, b) => new Date(a.checkIn) - new Date(b.checkIn));
  if (worked.length === 0) return { state: "out", since: null, lastOut: null, workedMinutes: 0, breakMinutes: 0, late: false, source: null };

  let workedMinutes = 0;
  let totalBreak = 0;
  worked.forEach((s) => {
    const end = s.checkOut ? new Date(s.checkOut) : now;
    const breakMinutes = (s.breaks || []).reduce((sum, b) => {
      if (!b.startTime) return sum;
      const bEnd = b.endTime ? new Date(b.endTime) : now;
      return sum + Math.max(0, (bEnd - new Date(b.startTime)) / 60000);
    }, 0);
    totalBreak += breakMinutes;
    workedMinutes += Math.max(0, (end - new Date(s.checkIn)) / 60000 - breakMinutes);
  });

  const open = worked.find((s) => !s.checkOut);
  const onBreak = open?.breaks?.some((b) => b.startTime && !b.endTime);
  const closed = worked.filter((s) => s.checkOut);
  return {
    state: open ? (onBreak ? "break" : "in") : "left",
    since: worked[0].checkIn,
    breakSince: onBreak ? open.breaks.find((b) => b.startTime && !b.endTime).startTime : null,
    lastOut: closed.length ? closed[closed.length - 1].checkOut : null,
    workedMinutes,
    breakMinutes: totalBreak,
    late: worked[0].status === "Late",
    lateBy: worked[0].lateBy || 0,
    source: worked[worked.length - 1].source || null,
  };
}
