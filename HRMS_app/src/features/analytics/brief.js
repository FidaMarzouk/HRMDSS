// Plain-text brief of the period: figures and signals with their evidence.
export function downloadBrief({ title, scope, period, tickers, signals }) {
  const line = (label, t, unit = "") =>
    t ? `- ${label}: ${t.value ?? "—"}${unit}${t.previous != null ? ` (previous period ${t.previous}${unit})` : ""}` : null;
  const text = [
    `ENOVA · ${title}`,
    `${scope} · ${period.from} → ${period.to} (previous period ${period.previous.from} → ${period.previous.to})`,
    "",
    "FIGURES",
    line("Attendance rate", tickers.attendanceRate, " %"),
    line("Punctuality", tickers.punctuality, " %"),
    line("Overtime", tickers.overtimeHours, " h"),
    line("Absences", tickers.absences),
    "",
    "SIGNALS",
    ...(signals.length ? signals.flatMap((s, i) => [`${i + 1}. [${s.label}] ${s.title}`, `   ${s.evidence}`, s.action ? `   Next step: ${s.action.label}` : null]) : ["Nothing needs attention in this period."]),
    "",
    `Generated ${new Date().toLocaleString("en-GB")}`,
  ]
    .filter((l) => l !== null)
    .join("\n");
  const url = URL.createObjectURL(new Blob([text], { type: "text/plain;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `enova-brief-${period.from}-${period.to}.txt`;
  a.click();
  URL.revokeObjectURL(url);
}
