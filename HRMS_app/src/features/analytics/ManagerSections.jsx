import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { MarkFrame, DataTable } from "../../components/marks/MarkFrame";
import { Figure, Meter, ProportionStrip, RankedBars } from "../../components/marks/Bars";
import { Columns } from "../../components/marks/Columns";
import { TONE, fmt } from "../../components/marks/palette";
import { StatusPill } from "../../components/ui/status-pill";
import { formatDay, toDayKey } from "../../lib/dates";
import { cn } from "../../lib/utils";

// The sections of the former manager dashboard, drawn with the ENOVA marks (tabs in tabs.js).

const EVENT_TYPES = { meeting: "Meetings", mission: "Missions", resourceReservation: "Reservations" };
const shortDay = (d) => formatDay(d, { day: "numeric", month: "short" });
const when = (d) => new Date(d).toLocaleString("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Africa/Tunis" });
const Grid = ({ children }) => <div className="grid gap-4 lg:grid-cols-2">{children}</div>;
const Figures = ({ children }) => <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{children}</div>;
const num = (v) => (v == null ? null : Number(v));

function Team({ data }) {
  const s = data.teamComposition?.skillsDistribution || {};
  const t = data.teamComposition?.departmentHiringTimeline || {};
  const d = t.tenureDistribution || {};
  const tenure = [
    { key: "a", label: "< 6 months", value: d.lessThan6Months || 0 },
    { key: "b", label: "6–12 months", value: d.sixToTwelveMonths || 0 },
    { key: "c", label: "1–2 years", value: d.oneToTwoYears || 0 },
    { key: "d", label: "2–5 years", value: d.twoToFiveYears || 0 },
    { key: "e", label: "> 5 years", value: d.moreThanFiveYears || 0 },
  ];
  const lm = data.leaveManagementMetrics;
  const cm = data.communicationMetrics;
  return (
    <div className="grid gap-4">
      <Figures>
        <Figure label="Team" value={fmt.int(data.managerData?.teamSize)} detail={data.managerData?.department} />
        <Figure label="Pending leave requests" value={fmt.int(lm?.pendingLeaveRequests?.count)} detail={`${fmt.pct(lm?.leaveApprovalRate?.approvalRate)} approval rate`} />
        <Figure label="Avg production hours" value={fmt.hours(num(data.teamProductivity?.avgProductionHours?.overallAverage))} detail="per team member per day" />
        <Figure label="Unread messages" value={fmt.int(cm?.unreadMessagesCount?.totalUnreadMessages)} detail={`${cm?.unreadMessagesCount?.totalUnreadNotifications || 0} unread notifications`} />
      </Figures>
      <Grid>
        <MarkFrame
          title="Team Skills Distribution"
          summary={`${fmt.one(s.averageSkillsPerEmployee)} skills per person on average.`}
          empty={!s.topSkills?.length}
          table={{ columns: [{ key: "skill", label: "Skill" }, { key: "count", label: "People", align: "right" }], rows: s.topSkills || [] }}
        >
          <RankedBars items={(s.topSkills || []).map((k) => ({ label: k.skill, value: k.count }))} />
        </MarkFrame>
        <MarkFrame
          title="Skills Gaps"
          summary="Skills only one person on the team has."
          empty={!s.skillsGaps?.length}
          emptyText="Every skill is shared by at least two people."
          table={{ columns: [{ key: "skill", label: "Skill" }, { key: "who", label: "Only" }], rows: (s.skillsGaps || []).map((g) => ({ skill: g.skill, who: g.employee?.name })) }}
        >
          <ul className="grid gap-1.5 text-[13px]">
            {(s.skillsGaps || []).map((g) => (
              <li key={`${g.skill}-${g.employee?.id}`} className="flex items-center justify-between gap-3 border-b border-line pb-1.5 last:border-0">
                <span className="text-ink">{g.skill}</span>
                <span className="text-ink-2">only {g.employee?.name}</span>
              </li>
            ))}
          </ul>
        </MarkFrame>
        <MarkFrame
          title="Team Tenure"
          summary={`Average tenure ${fmt.int(t.averageTenureMonths)} months.`}
          table={{ columns: [{ key: "label", label: "Tenure" }, { key: "value", label: "People", align: "right" }], rows: tenure }}
        >
          <Columns data={tenure} series={[{ key: "value", label: "People" }]} labelEvery={1} height={120} />
          {t.recentHires?.length > 0 && (
            <div className="grid gap-1">
              <p className="label-key">Recent hires</p>
              <ul className="grid gap-1 text-[12.5px]">
                {t.recentHires.map((h) => (
                  <li key={h.id || h.name} className="flex justify-between gap-3">
                    <span className="text-ink">{h.name} <span className="text-ink-3">· {h.position}</span></span>
                    <span className="figure text-ink-2">{formatDay(h.hireDate)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </MarkFrame>
      </Grid>
    </div>
  );
}

function Attendance({ data }) {
  const a = data.teamAttendanceMetrics || {};
  return (
    <div className="grid gap-4">
      <Figures>
        <Figure label="Team attendance rate" value={fmt.pct(a.attendanceRate?.rate)} detail={`${a.attendanceRate?.actualAttendance || 0} of ${a.attendanceRate?.expectedAttendance || 0} expected days`} />
        <Figure label="Absenteeism rate" value={fmt.pct(a.absenteeismRate?.rate)} detail={`${a.absenteeismRate?.absentDays || 0} absent days · ${a.absenteeismRate?.approvedLeaveDays || 0} leave days`} />
        <Figure label="Avg check-in" value={a.avgCheckTimes?.averageCheckIn || "—"} detail={`check-out ${a.avgCheckTimes?.averageCheckOut || "—"}`} />
        <Figure label="Working days" value={fmt.int(a.absenteeismRate?.workDays)} detail="in the period, so far" />
      </Figures>
      <MarkFrame
        title="Late Arrivals Trend"
        summary="Team members who arrived after 08:30, per working day."
        empty={!a.lateArrivalsTrend?.length}
        table={{ columns: [{ key: "date", label: "Day", format: shortDay }, { key: "count", label: "Late", align: "right" }], rows: a.lateArrivalsTrend || [] }}
      >
        <Columns data={(a.lateArrivalsTrend || []).map((d) => ({ key: d.date, label: shortDay(d.date), count: d.count }))} series={[{ key: "count", label: "Late", color: TONE.amber }]} />
      </MarkFrame>
    </div>
  );
}

// Month grid of approved department leave, Monday first.
function LeaveCalendar({ calendar, period }) {
  const [month, setMonth] = useState(() => period.to.slice(0, 7));
  const byDay = calendar?.leavesByDay || {};
  const cells = useMemo(() => {
    const [y, m] = month.split("-").map(Number);
    const first = new Date(Date.UTC(y, m - 1, 1));
    const offset = (first.getUTCDay() + 6) % 7;
    const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
    return [...Array(offset).fill(null), ...Array.from({ length: days }, (_, i) => `${month}-${String(i + 1).padStart(2, "0")}`)];
  }, [month]);
  const shift = (n) => {
    const [y, m] = month.split("-").map(Number);
    const d = new Date(Date.UTC(y, m - 1 + n, 1));
    setMonth(d.toISOString().slice(0, 7));
  };
  const label = new Date(`${month}-01T12:00:00Z`).toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });
  const today = toDayKey(new Date());

  return (
    <div className="grid gap-2">
      <div className="flex items-center justify-between">
        <button type="button" onClick={() => shift(-1)} className="grid h-8 w-8 place-items-center rounded-md text-ink-2 hover:bg-sunk" aria-label="Previous month"><ChevronLeft className="h-4 w-4" /></button>
        <p className="text-[13px] font-semibold text-ink" aria-live="polite">{label}</p>
        <button type="button" onClick={() => shift(1)} className="grid h-8 w-8 place-items-center rounded-md text-ink-2 hover:bg-sunk" aria-label="Next month"><ChevronRight className="h-4 w-4" /></button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-[11px]">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
          <span key={d} className="pb-1 text-center font-mono text-[10px] uppercase tracking-[0.08em] text-ink-3">{d}</span>
        ))}
        {cells.map((day, i) => {
          if (!day) return <span key={`blank-${i}`} />;
          const leaves = byDay[day] || [];
          const weekend = i % 7 >= 5;
          return (
            <div key={day} className={cn("min-h-[64px] rounded-md border border-line p-1", weekend ? "bg-sunk/50" : "bg-panel", day === today && "border-teal")}>
              <p className="figure text-right text-[10.5px] text-ink-3">{Number(day.slice(8))}</p>
              <ul className="grid gap-0.5">
                {leaves.slice(0, 3).map((l) => (
                  <li key={l.id} title={`${l.employee}: ${l.reason} (${l.status})`} className="truncate rounded-[3px] bg-teal/15 px-1 text-[10.5px] text-ink">
                    {l.employee.split(" ")[0]}
                  </li>
                ))}
                {leaves.length > 3 && <li className="text-[10px] text-ink-3">+{leaves.length - 3} more</li>}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Leave({ data, period }) {
  const l = data.leaveManagementMetrics || {};
  const r = l.leaveApprovalRate || {};
  const dist = l.leaveDistribution || [];
  const totalDays = dist.reduce((n, x) => n + x.days, 0);
  const list = l.departmentLeaveCalendar?.leavesList || [];
  return (
    <div className="grid gap-4">
      <Figures>
        <Figure label="Pending requests" value={fmt.int(l.pendingLeaveRequests?.count)} detail="waiting on you" />
        <Figure label="Approval rate" value={fmt.pct(r.approvalRate)} detail={`${r.approvedRequests || 0} approved · ${r.rejectedRequests || 0} rejected`} />
        <Figure label="Total requests" value={fmt.int(r.totalRequests)} detail="in the period" />
        <Figure label="Main leave type" value={dist[0]?.type?.replace(" Leave", "") || "—"} detail={`${dist[0]?.days || 0} working days`} />
      </Figures>
      <Grid>
        <MarkFrame
          title="Leave Distribution by Type"
          summary={`${totalDays} working days of approved leave in the period.`}
          empty={!dist.length}
          table={{ columns: [{ key: "type", label: "Type" }, { key: "days", label: "Days", align: "right" }, { key: "count", label: "Requests", align: "right" }], rows: dist }}
        >
          <ProportionStrip parts={dist.map((x) => ({ label: x.type, value: x.days }))} format={(v) => `${v} d`} />
          <DataTable caption="Top leave types" columns={[{ key: "type", label: "Type" }, { key: "days", label: "Days", align: "right" }, { key: "count", label: "Requests", align: "right" }]} rows={dist} />
        </MarkFrame>
        <MarkFrame
          title="Leave Approval Statistics"
          table={{ columns: [{ key: "k", label: "Decision" }, { key: "v", label: "Requests", align: "right" }], rows: [{ k: "Approved", v: r.approvedRequests || 0 }, { k: "Rejected", v: r.rejectedRequests || 0 }, { k: "Pending", v: r.pendingRequests || 0 }] }}
        >
          <ProportionStrip
            parts={[
              { label: "Approved", value: r.approvedRequests || 0, color: TONE.teal },
              { label: "Rejected", value: r.rejectedRequests || 0, color: TONE.red },
              { label: "Pending", value: r.pendingRequests || 0, className: "border border-dashed border-teal bg-transparent" },
            ]}
          />
          <Meter label="Approval rate (team average)" value={r.approvalRate || 0} valueText={fmt.pct(r.approvalRate)} />
          <p className="text-[12.5px] text-ink-2">Total leave days in the selected period: <span className="figure text-ink">{totalDays}</span></p>
        </MarkFrame>
        <MarkFrame title="Department Leave Calendar" summary="Approved leave in your department." className="lg:col-span-2">
          <LeaveCalendar calendar={l.departmentLeaveCalendar} period={period} />
          <div className="grid gap-1">
            <p className="label-key">Approved leaves in the period</p>
            {list.length ? (
              <ul className="grid max-h-48 gap-1 overflow-y-auto text-[12.5px]">
                {list.map((x) => (
                  <li key={x.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-line py-1.5 last:border-0">
                    <span className="text-ink">{x.employee} <span className="text-ink-3">· {x.reason}</span></span>
                    <span className="flex items-center gap-2">
                      <span className="figure text-ink-2">{shortDay(x.startDate)} → {shortDay(x.endDate)}</span>
                      <StatusPill status="approved">{x.status}</StatusPill>
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[12.5px] text-ink-3">No approved leaves in the selected period.</p>
            )}
          </div>
        </MarkFrame>
      </Grid>
    </div>
  );
}

function Calendar({ data }) {
  const c = data.calendarMetrics || {};
  const p = c.eventParticipationRates || {};
  const events = c.upcomingEvents || [];
  const types = Object.entries(p.eventTypes || {}).filter(([, s]) => s.total > 0);
  return (
    <Grid>
      <MarkFrame title="Upcoming Events" empty={!events.length} emptyText="No upcoming events." className="lg:col-span-2">
        <DataTable
          caption="Upcoming events"
          columns={[
            { key: "title", label: "Event" },
            { key: "startDateTime", label: "Date", format: when },
            { key: "location", label: "Where" },
            { key: "status", label: "Status" },
          ]}
          rows={events.slice(0, 8)}
        />
      </MarkFrame>
      <MarkFrame
        title="Event Participation"
        summary="Accepted invitations, by event type."
        table={{ columns: [{ key: "type", label: "Type" }, { key: "accepted", label: "Accepted", align: "right" }, { key: "total", label: "Invited", align: "right" }, { key: "participationRate", label: "Rate", align: "right", format: fmt.pct }], rows: types.map(([type, s]) => ({ type: EVENT_TYPES[type] || type, ...s })) }}
      >
        <Meter label="Overall" value={num(p.overallParticipationRate) || 0} valueText={fmt.pct(num(p.overallParticipationRate))} />
        {types.map(([type, s]) => (
          <Meter key={type} label={EVENT_TYPES[type] || type} value={s.participationRate} valueText={`${fmt.pct(s.participationRate)} · ${s.accepted}/${s.total}`} color={TONE.blue} />
        ))}
      </MarkFrame>
      <MarkFrame
        title="Weekly Participation Trend"
        empty={!p.trendByWeek?.length}
        table={{ columns: [{ key: "week", label: "Week" }, { key: "accepted", label: "Accepted", align: "right" }, { key: "totalInvites", label: "Invited", align: "right" }, { key: "participationRate", label: "Rate", align: "right", format: fmt.pct }], rows: p.trendByWeek || [] }}
      >
        <Columns data={(p.trendByWeek || []).map((w) => ({ key: w.week, label: w.week.replace(/^\d{4}-/, ""), rate: w.participationRate }))} series={[{ key: "rate", label: "Participation" }]} format={(v) => `${Math.round(v)} %`} labelEvery={1} height={120} />
      </MarkFrame>
    </Grid>
  );
}

function Productivity({ data }) {
  const t = data.teamProductivity || {};
  const trends = t.overtimeTrends || [];
  const members = t.teamMemberProductivity || [];
  return (
    <div className="grid gap-4">
      <Figures>
        <Figure label="Avg production hours" value={fmt.hours(num(t.avgProductionHours?.overallAverage))} detail="per team member per day" />
        <Figure label="Total overtime" value={fmt.hours(trends.reduce((n, d) => n + (d.totalHours || 0), 0))} detail={`${trends.length} days with overtime`} />
      </Figures>
      <MarkFrame
        title="Overtime Trends"
        summary="Team overtime per day, and the average per person who worked overtime."
        empty={!trends.length}
        table={{ columns: [{ key: "date", label: "Day", format: shortDay }, { key: "totalHours", label: "Total", align: "right", format: fmt.hours }, { key: "employeeCount", label: "People", align: "right" }, { key: "averagePerEmployee", label: "Per person", align: "right", format: fmt.hours }], rows: trends }}
      >
        <Columns
          data={trends.map((d) => ({ key: d.date, label: shortDay(d.date), totalHours: d.totalHours, averagePerEmployee: d.averagePerEmployee }))}
          series={[{ key: "totalHours", label: "Total hours", color: TONE.amber }, { key: "averagePerEmployee", label: "Per person", color: TONE.blue }]}
          format={fmt.one}
        />
      </MarkFrame>
      <MarkFrame title="Team Productivity Breakdown" summary="Hours worked against the expected 8 h 30 per day, per team member." empty={!members.length}>
        <DataTable
          caption="Team productivity breakdown"
          columns={[
            { key: "name", label: "Team member" },
            { key: "position", label: "Position" },
            { key: "avgHours", label: "Avg hours", align: "right", format: fmt.hours },
            { key: "overtime", label: "Overtime", align: "right", format: fmt.hours },
            { key: "worked", label: "Worked / expected", align: "right", format: (_, m) => `${fmt.one(m.details?.totalProductionHours)} / ${fmt.one(m.details?.expectedProductionHours)} h` },
            { key: "trend", label: "Trend", format: (v) => (v === "up" ? "▲ up" : v === "down" ? "▼ down" : "— steady") },
          ]}
          rows={members}
        />
      </MarkFrame>
    </div>
  );
}

function Communication({ data }) {
  const c = data.communicationMetrics || {};
  const r = c.responseTime || {};
  const dist = r.responseTimeDistribution || {};
  const bins = [
    { label: "Under 5 min", ...dist.under5Minutes },
    { label: "5–15 min", ...dist.under15Minutes },
    { label: "15–60 min", ...dist.under60Minutes },
    { label: "Over 60 min", ...dist.over60Minutes },
  ];
  const daily = c.dailyMessages || [];
  const active = c.teamEngagement?.mostActiveUsers || [];
  return (
    <div className="grid gap-4">
      <Figures>
        <Figure label="Unread messages" value={fmt.int(c.unreadMessagesCount?.totalUnreadMessages)} detail={`${c.unreadMessagesCount?.totalUnreadNotifications || 0} unread notifications`} />
        <Figure label="Avg response time" value={`${fmt.int(num(r.averageResponseTimeMinutes))} min`} detail={`${r.responsesAnalyzed || 0} replies measured`} />
        <Figure label="Team participation" value={fmt.pct(num(c.teamEngagement?.participationRate))} detail={`${c.teamEngagement?.activeUsers || 0} active members`} />
      </Figures>
      <Grid>
        <MarkFrame
          title="Response Time Distribution"
          table={{ columns: [{ key: "label", label: "Response time" }, { key: "count", label: "Replies", align: "right" }, { key: "percentage", label: "Share", align: "right", format: (v) => fmt.pct(num(v)) }], rows: bins }}
        >
          <RankedBars sort={false} items={bins.map((b) => ({ label: b.label, value: b.count || 0, note: fmt.pct(num(b.percentage) || 0) }))} />
        </MarkFrame>
        <MarkFrame
          title="Daily Message Activity"
          empty={!daily.length}
          table={{ columns: [{ key: "fullDate", label: "Day", format: shortDay }, { key: "count", label: "Messages", align: "right" }], rows: daily }}
        >
          <Columns data={daily.map((d) => ({ key: d.fullDate, label: d.date, count: d.count }))} series={[{ key: "count", label: "Messages" }]} />
        </MarkFrame>
        <MarkFrame
          title="Most Active Team Members"
          summary="Messages sent in team chat during the period."
          empty={!active.length}
          table={{ columns: [{ key: "fullName", label: "Team member" }, { key: "messageCount", label: "Messages", align: "right" }], rows: active }}
        >
          <RankedBars items={active.map((m) => ({ id: m.userId, label: m.fullName || `${m.firstName} ${m.lastName}`, value: m.messageCount }))} />
        </MarkFrame>
      </Grid>
    </div>
  );
}

const SECTIONS = { team: Team, attendance: Attendance, leave: Leave, calendar: Calendar, productivity: Productivity, communication: Communication };

export function ManagerSection({ tab, data, period }) {
  const Section = SECTIONS[tab] || Team;
  return <Section data={data} period={period} />;
}
