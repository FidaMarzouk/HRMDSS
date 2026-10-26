import { Link } from "react-router-dom";
import { StatusPill } from "../../components/ui/status-pill";
import { useTodaySessions } from "../../lib/queries";
import { pathFor } from "../../config/navigation";
import { formatClock, summarizeSessions } from "../time/sessions";

// Current punch state next to the avatar; links to the Time page.
export function PunchStatus({ className }) {
  const { data, isLoading } = useTodaySessions();
  if (isLoading) return null;
  const s = summarizeSessions(data || []);

  const pill = {
    in: { status: s.late ? "late" : "present", text: `In since ${formatClock(s.since)}` },
    break: { status: "pending", text: `On break since ${formatClock(s.breakSince)}` },
    left: { status: "neutral", text: `Out at ${formatClock(s.lastOut)}` },
    out: { status: "neutral", text: "Not punched in" },
  }[s.state];

  return (
    <Link to={pathFor("time")} className={className} title="Open Time">
      <StatusPill status={pill.status}>{pill.text}</StatusPill>
    </Link>
  );
}
