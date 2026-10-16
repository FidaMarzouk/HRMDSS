import { useAuth } from "../../context/AuthContext";
import { usePresence, useToday, useTodaySessions } from "../../lib/queries";
import { StatusPill } from "../../components/ui/status-pill";
import { formatDay } from "../../lib/dates";
import { statusKind } from "../leave/leaveUtils";
import { formatClock, summarizeSessions } from "../time/sessions";
import { FigureStrip } from "./FigureStrip";
import { DecisionQueue } from "./DecisionQueue";
import { FloorPanel } from "./FloorPanel";

const REVIEWERS = ["admin", "manager", "superAdmin"];

function Panel({ title, meta, children }) {
  return (
    <section className="min-w-0 rounded-xl border border-line bg-panel p-4">
      <div className="mb-1 flex items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold">{title}</h2>
        {meta && <span className="label-key">{meta}</span>}
      </div>
      {children}
    </section>
  );
}

function MyRequests({ requests }) {
  if (!requests?.length) return <p className="pt-2 text-sm text-ink-2">No requests in progress.</p>;
  return (
    <ul>
      {requests.map((r) => (
        <li key={r._id} className="flex items-center gap-3 border-t border-line py-2.5">
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13.5px]">{r.reason}</p>
            <p className="figure text-[11px] uppercase text-ink-3">
              {formatDay(r.startDate, { day: "numeric", month: "short" })} – {formatDay(r.endDate, { day: "numeric", month: "short" })}
            </p>
          </div>
          <StatusPill status={statusKind(r.status)}>{r.status}</StatusPill>
        </li>
      ))}
    </ul>
  );
}

const sessionFigure = (sessions) => {
  const s = summarizeSessions(sessions);
  if (s.state === "in") return { value: formatClock(s.since), label: s.late ? "in since (late)" : "in since", tone: s.late ? "amber" : "teal" };
  if (s.state === "break") return { value: formatClock(s.breakSince), label: "on break since", tone: "neutral" };
  if (s.state === "left") return { value: formatClock(s.lastOut), label: "punched out at", tone: "neutral" };
  return { value: "—", label: "not punched in", tone: "neutral" };
};

/**
 * Home for every role: what needs a decision, who is on the floor and, for
 * employees, their own open items. Data: GET /api/today and /api/presence.
 */
export default function TodayPage() {
  const { user } = useAuth();
  const reviewer = REVIEWERS.includes(user?.role);
  const today = useToday();
  const presence = usePresence();
  const sessions = useTodaySessions();
  const data = today.data;

  const figures = reviewer
    ? [
        { value: data ? `${data.presence.in}/${data.presence.total}` : "", label: "in the building", tone: "teal" },
        { value: data?.presence.late ?? "", label: "late today", tone: "amber" },
        { value: data?.presence.away ?? "", label: "on leave · mission", tone: "neutral" },
        { value: data?.awaiting.total ?? "", label: "awaiting you", tone: "teal" },
      ]
    : [
        sessionFigure(sessions.data),
        { value: data?.mine?.remainingLeaveDays ?? "—", label: "leave days left", tone: "teal" },
        { value: data?.mine?.openRequests.length ?? "", label: "requests in progress", tone: "neutral" },
        { value: data?.mine?.upcomingEvents ?? "", label: "events, next 7 days", tone: "neutral" },
      ];

  const floorScope = user?.role === "admin" || user?.role === "superAdmin" ? "company" : "your department";

  return (
    <div className="space-y-4">
      {today.isError && (
        <p role="alert" className="rounded-md border border-red/30 bg-red/10 px-3 py-2 text-sm text-red">
          {"Today's figures could not be loaded. They will retry automatically."}
        </p>
      )}
      <FigureStrip figures={figures} loading={today.isLoading} />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div className="space-y-4">
          {reviewer ? (
            <Panel title="Needs your decision" meta="by deadline">
              <DecisionQueue items={data?.queue || []} loading={today.isLoading} />
            </Panel>
          ) : (
            <Panel title="Your requests" meta="in progress">
              <MyRequests requests={data?.mine?.openRequests} />
            </Panel>
          )}
          {reviewer && data?.mine?.openRequests?.length > 0 && (
            <Panel title="Your own requests" meta="in progress">
              <MyRequests requests={data.mine.openRequests} />
            </Panel>
          )}
        </div>
        <Panel title="On the floor now" meta={`live · ${floorScope}`}>
          <FloorPanel data={presence.data} loading={presence.isLoading} />
        </Panel>
      </div>
    </div>
  );
}
