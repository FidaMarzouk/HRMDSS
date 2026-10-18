import { Link } from "react-router-dom";
import { MarkFrame, DataTable } from "../../components/marks/MarkFrame";
import { Figure, Meter, ProportionStrip, RankedBars } from "../../components/marks/Bars";
import { Columns, HeatStrip } from "../../components/marks/Columns";
import { BarcodeRow } from "../../components/marks/Barcode";
import { Ticker } from "../../components/marks/Ticker";
import { Legend } from "../../components/marks/MarkFrame";
import { TONE, fmt } from "../../components/marks/palette";
import { Avatar } from "../../components/ui/avatar";
import { SegmentedControl } from "../../components/ui/segmented-control";
import { StatusPill } from "../../components/ui/status-pill";
import { errorMessage } from "../../lib/api";
import { formatDay } from "../../lib/dates";
import { pathFor } from "../../config/navigation";
import { PeriodPicker } from "./PeriodPicker";
import { previousOf } from "./period";
import { usePeriodParams } from "./usePeriodParams";
import { useDashboard } from "./analyticsApi";

const TABS = [
  { value: "overview", label: "Overview" },
  { value: "attendance", label: "Attendance" },
  { value: "leave", label: "Leave" },
  { value: "calendar", label: "Calendar" },
];
const CELL = { Present: "present", Late: "late", Absent: "absent", Leave: "leave" };
const EVENT_TYPES = { meeting: "Meeting", mission: "Mission", resourceReservation: "Reservation" };
const shortDay = (d) => formatDay(d, { day: "numeric", month: "short" });
const when = (d) => new Date(d).toLocaleString("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Africa/Tunis" });
const leaveStatus = (s) => (/Rejected/.test(s) ? "rejected" : /Approved/.test(s) && !/Manager/.test(s) ? "approved" : "pending");
// Avatar from a display name ("Rim Ferchichi").
const person = (name, profilePicture) => {
  const [firstName, ...rest] = (name || "").split(" ");
  return { firstName, lastName: rest.join(" "), profilePicture };
};
const Grid = ({ children }) => <div className="grid gap-4 lg:grid-cols-2">{children}</div>;

// Several sessions can share a day: add them up per day.
const perDay = (rows, key) => {
  const map = new Map();
  rows.forEach((r) => map.set(r.date, (map.get(r.date) || 0) + (r[key] || 0)));
  return [...map.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, value]) => ({ key: date, date, label: shortDay(date), value: Math.round(value * 100) / 100 }));
};

function Overview({ data }) {
  const p = data.performanceMetrics || {};
  const team = data.teamInfo || {};
  return (
    <Grid>
      <MarkFrame
        title="Monthly performance"
        summary={`Attendance, punctuality, hours against 8 h 30 a day and events attended. ${p.vsLastYear ? `${p.vsLastYear > 0 ? "+" : ""}${p.vsLastYear} % against last year.` : ""}`}
        empty={!p.trend?.length}
        table={{
          columns: [
            { key: "month", label: "Month" },
            { key: "value", label: "Score", align: "right" },
            { key: "attendanceRate", label: "Attendance", align: "right", format: fmt.pct },
            { key: "punctualityRate", label: "Punctuality", align: "right", format: fmt.pct },
            { key: "productionHours", label: "Hours", align: "right", format: fmt.hours },
            { key: "expectedHours", label: "Expected", align: "right", format: fmt.hours },
          ],
          rows: p.trend || [],
        }}
      >
        <p className="figure text-2xl text-ink">{fmt.int(p.score)}<span className="ml-1 text-[13px] text-ink-3">/ 100 for the period</span></p>
        <Columns data={(p.trend || []).map((t) => ({ key: t.month, label: t.month, value: t.value }))} series={[{ key: "value", label: "Score" }]} labelEvery={1} height={120} />
      </MarkFrame>
      <MarkFrame title={team.department?.name || "My team"} summary={`${team.totalTeamMembers || 0} team members`}>
        {team.manager && (
          <div className="flex items-center gap-3 rounded-lg bg-raise p-2.5">
            <Avatar user={person(team.manager.name, team.manager.profilePicture)} size="md" />
            <div className="min-w-0">
              <p className="text-[13px] font-medium text-ink">{team.manager.name}</p>
              <p className="truncate text-[12px] text-ink-2">Manager · {team.manager.position}</p>
            </div>
          </div>
        )}
        <ul className="grid max-h-72 gap-1 overflow-y-auto">
          {(team.teamMembers || []).map((m) => (
            <li key={m.id} className="flex items-center gap-2.5 border-b border-line py-1.5 last:border-0">
              <Avatar user={person(m.name, m.profilePicture)} size="sm" />
              <div className="min-w-0 flex-1">
                <Link to={`${pathFor("people")}?person=${m.id}`} className="block truncate text-[13px] text-ink hover:underline">{m.name}</Link>
                <p className="truncate text-[11.5px] text-ink-3">{m.position}{m.skills?.length ? ` · ${m.skills.slice(0, 3).join(", ")}` : ""}</p>
              </div>
            </li>
          ))}
        </ul>
      </MarkFrame>
    </Grid>
  );
}

function Attendance({ data }) {
  const a = data.attendanceMetrics || {};
  const rate = a.attendanceRate || {};
  const trend = rate.trend || [];
  const late = a.punctualityScore?.lateTrend || [];
  const hours = perDay(a.productionHoursTrend?.dailyTrend || [], "productionHours");
  const overtime = perDay(a.overtimeHours?.dailyOvertime || [], "overtimeHours");
  return (
    <Grid>
      <MarkFrame
        title="Attendance Trend"
        summary={`${rate.presentDays || 0} on time, ${rate.lateDays || 0} late, ${rate.absentDays || 0} absent, ${rate.leaveDays || 0} on leave over ${rate.totalWorkdays || 0} working days.`}
        empty={!trend.length}
        table={{ columns: [{ key: "date", label: "Day", format: shortDay }, { key: "status", label: "Status" }], rows: trend }}
      >
        <BarcodeRow days={trend.map((t) => t.date)} cells={trend.map((t) => CELL[t.status] || null)} className="h-8" />
        <Legend items={[{ label: "Present", color: TONE.teal }, { label: "Late", color: TONE.amber }, { label: "Absent", className: "border border-red/70" }, { label: "On leave", className: "hatch-ink" }, { label: "No record", className: "bg-sunk" }]} />
        <ProportionStrip parts={(rate.statusSummary || []).map((s) => ({ label: s.name, value: s.value, ...(s.name === "Present" ? { color: TONE.teal } : s.name === "Late" ? { color: TONE.amber } : s.name === "Absent" ? { color: TONE.red } : { className: "hatch-ink" }) }))} format={(v) => `${v} d`} />
      </MarkFrame>
      <MarkFrame
        title="Late Minutes Trend"
        summary={`Average ${fmt.int(a.punctualityScore?.averageLateMinutes)} minutes late on late days.`}
        empty={!late.length}
        emptyText="No late arrivals in this period."
        table={{ columns: [{ key: "date", label: "Day", format: shortDay }, { key: "lateMinutes", label: "Minutes late", align: "right" }], rows: late }}
      >
        <Columns data={late.map((d) => ({ key: d.date, label: shortDay(d.date), value: d.lateMinutes }))} series={[{ key: "value", label: "Minutes late", color: TONE.amber }]} labelEvery={1} height={120} />
      </MarkFrame>
      <MarkFrame
        title="Production Hours Trend"
        summary={`${fmt.hours(a.productionHoursTrend?.totalProductionHours)} in total · ${fmt.hours(a.productionHoursTrend?.averageProductionHours)} a day on average.`}
        empty={!hours.length}
        table={{ columns: [{ key: "date", label: "Day", format: shortDay }, { key: "value", label: "Hours", align: "right", format: fmt.hours }], rows: hours }}
      >
        <Columns data={hours} series={[{ key: "value", label: "Hours" }]} target={8.5} format={fmt.one} />
        <p className="text-[11px] text-ink-3">Dashed line: the expected 8 h 30.</p>
      </MarkFrame>
      <MarkFrame
        title="Overtime Hours"
        summary={`${fmt.hours(a.overtimeHours?.totalOvertimeHours)} over ${a.overtimeHours?.daysWithOvertime || 0} days.`}
        empty={!overtime.length}
        table={{ columns: [{ key: "date", label: "Day", format: shortDay }, { key: "value", label: "Overtime", align: "right", format: fmt.hours }], rows: overtime }}
      >
        <Columns data={overtime} series={[{ key: "value", label: "Overtime", color: TONE.amber }]} format={fmt.one} />
      </MarkFrame>
    </Grid>
  );
}

function Leave({ data }) {
  const l = data.leaveMetrics || {};
  const b = l.leaveBalanceIndicator || {};
  const counts = Object.entries(l.leaveRequestStatus?.counts || {}).map(([status, count]) => ({ status, count }));
  const usage = l.leaveUsageByType?.leaveUsageByType || [];
  const recent = l.leaveRequestStatus?.recentLeaveRequests || [];
  return (
    <Grid>
      <MarkFrame title="Leave Balance" table={{ columns: [{ key: "k", label: "Measure" }, { key: "v", label: "Days", align: "right" }], rows: [{ k: "Allowed", v: b.totalAllowed }, { k: "Used", v: b.used }, { k: "Remaining", v: b.remaining }] }}>
        <p className="figure text-2xl text-ink">{fmt.int(b.remaining)}<span className="ml-1 text-[13px] text-ink-3">days left</span></p>
        <ProportionStrip parts={[{ label: "Used", value: b.used || 0, color: TONE.teal }, { label: "Remaining", value: b.remaining || 0, color: TONE.line2 }]} format={(v) => `${v} d`} />
      </MarkFrame>
      <MarkFrame title="Leave Request Status" empty={!counts.some((c) => c.count)} table={{ columns: [{ key: "status", label: "Status" }, { key: "count", label: "Requests", align: "right" }], rows: counts }}>
        <RankedBars items={counts.map((c) => ({ label: c.status, value: c.count, color: /Rejected/.test(c.status) ? TONE.red : /Approved/.test(c.status) ? TONE.teal : TONE.blue }))} />
      </MarkFrame>
      <MarkFrame
        title="Leave Usage By Type"
        empty={!usage.length}
        table={{ columns: [{ key: "reason", label: "Type" }, { key: "days", label: "Days", align: "right" }, { key: "count", label: "Requests", align: "right" }], rows: usage }}
      >
        <ProportionStrip parts={usage.map((u) => ({ label: u.reason, value: u.days }))} format={(v) => `${v} d`} />
      </MarkFrame>
      <MarkFrame title="Recent Leave Requests" empty={!recent.length} emptyText="No recent leave requests.">
        <ul className="grid gap-1 text-[12.5px]">
          {recent.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-line py-1.5 last:border-0">
              <span>
                <span className="figure text-ink">{shortDay(r.startDate)} → {formatDay(r.endDate)}</span>
                <span className="text-ink-3"> · {r.reason}</span>
              </span>
              <StatusPill status={leaveStatus(r.status)}>{r.status}</StatusPill>
            </li>
          ))}
        </ul>
      </MarkFrame>
    </Grid>
  );
}

function Calendar({ data }) {
  const c = data.calendarMetrics || {};
  const u = c.upcomingEventsCounter || {};
  const d = c.calendarDensity || {};
  const next = u.nextEvents || [];
  const hours = (d.busyHoursDistribution || []).map((h, i) => ({ key: i, label: h.timeLabel || `${String(i).padStart(2, "0")}:00`, short: String(h.hour ?? i).padStart(2, "0"), value: h.count }));
  return (
    <Grid>
      <MarkFrame title="Upcoming Events">
        <div className="grid grid-cols-3 gap-2">
          <Figure label="Today" value={fmt.int(u.today?.total)} />
          <Figure label="This week" value={fmt.int(u.thisWeek?.total)} />
          <Figure label="This month" value={fmt.int(u.thisMonth?.total)} />
        </div>
        <ProportionStrip
          parts={[
            { label: "Meetings", value: u.thisWeek?.meeting || 0 },
            { label: "Missions", value: u.thisWeek?.mission || 0 },
            { label: "Reservations", value: u.thisWeek?.resourceReservation || 0 },
            { label: "Other", value: u.thisWeek?.other || 0 },
          ]}
        />
        <p className="text-[11px] text-ink-3">Split of this week&apos;s events.</p>
      </MarkFrame>
      <MarkFrame
        title="Calendar Density"
        summary={`${d.totalEvents || 0} events · ${d.busyDays || 0} busy days.`}
        empty={!d.dailyDensity?.length}
        table={{ columns: [{ key: "date", label: "Day", format: shortDay }, { key: "count", label: "Events", align: "right" }], rows: d.dailyDensity || [] }}
      >
        <Columns data={(d.dailyDensity || []).map((x) => ({ key: x.date, label: shortDay(x.date), value: x.count }))} series={[{ key: "value", label: "Events", color: TONE.blue }]} height={110} />
      </MarkFrame>
      <MarkFrame title="Busy Hours Distribution" summary="Your events by hour of the day." table={{ columns: [{ key: "label", label: "Hour" }, { key: "value", label: "Events", align: "right" }], rows: hours }}>
        <HeatStrip cells={hours} />
      </MarkFrame>
      <MarkFrame title="Next Events" empty={!next.length} emptyText="No upcoming events.">
        <DataTable caption="Next events" columns={[{ key: "title", label: "Event" }, { key: "type", label: "Type", format: (t) => EVENT_TYPES[t] || t }, { key: "startDate", label: "When", format: when }, { key: "location", label: "Where" }]} rows={next} />
      </MarkFrame>
    </Grid>
  );
}

const SECTIONS = { overview: Overview, attendance: Attendance, leave: Leave, calendar: Calendar };

/** My stats: the signed-in person's own attendance, hours, leave and calendar. */
export default function MyStatsPage() {
  const { params, period, compare, update } = usePeriodParams();
  const tab = TABS.some((t) => t.value === params.get("tab")) ? params.get("tab") : "overview";
  const current = useDashboard("employee", period);
  const previous = useDashboard("employee", previousOf(period));
  const data = current.data;
  const prev = compare ? previous.data : undefined;
  const Section = SECTIONS[tab];
  const a = data?.attendanceMetrics;
  const pa = prev?.attendanceMetrics;
  const balance = data?.leaveMetrics?.leaveBalanceIndicator;
  const ticks = (a?.attendanceRate?.trend || []).filter((t) => CELL[t.status] && t.status !== "Leave").map((t) => ({ date: t.date, value: t.status === "Absent" ? 0 : 100 }));

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="label-key">{data?.userData?.position || "Personal"}</p>
          <h2 className="font-display text-2xl font-bold leading-tight">My stats</h2>
        </div>
        <PeriodPicker value={period} onChange={(r) => update(r)} compare={compare} onCompareChange={(v) => update({ compare: v ? null : "0" })} />
      </div>

      {current.isError ? (
        <p role="alert" className="rounded-xl border border-red/40 bg-panel px-4 py-3 text-[13px] text-red">Could not load your stats: {errorMessage(current.error)}</p>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Ticker label="Attendance rate" unit="%" value={a?.attendanceRate?.rate} previous={pa?.attendanceRate?.rate} daily={ticks} target={95} loading={!data} detail={`${a?.attendanceRate?.totalWorkdays ?? "—"} working days`} />
            <Ticker label="Punctuality" unit="%" value={a?.punctualityScore?.score} previous={pa?.punctualityScore?.score} loading={!data} detail={`${a?.punctualityScore?.onTimeArrivals ?? 0} on time · ${a?.punctualityScore?.lateArrivals ?? 0} late`} />
            <Ticker label="Production hours" unit="h" better="neutral" value={a?.productionHoursTrend?.totalProductionHours} previous={pa?.productionHoursTrend?.totalProductionHours} daily={perDay(a?.productionHoursTrend?.dailyTrend || [], "productionHours")} target={8.5} loading={!data} detail={`${fmt.hours(a?.productionHoursTrend?.averageProductionHours)} a day`} />
            <div className="flex flex-col gap-2 rounded-xl border border-line bg-panel p-3.5">
              <p className="text-[13px] font-medium text-ink">Leave balance</p>
              <p className="figure text-[26px] font-medium leading-none text-ink">{balance ? fmt.int(balance.remaining) : "—"}<span className="ml-1 text-[15px] text-ink-2">days</span></p>
              <Meter value={balance?.used || 0} max={balance?.totalAllowed || 1} label="Used" valueText={balance ? `${balance.used} of ${balance.totalAllowed} (${fmt.pct(balance.percentageUsed)})` : ""} />
            </div>
          </div>

          <div className="flex justify-end">
            <SegmentedControl label="Section" value={tab} onChange={(v) => update({ tab: v })} options={TABS} size="sm" />
          </div>
          {data ? <Section data={data} /> : <div className="h-64 animate-pulse rounded-xl border border-line bg-panel" aria-busy="true" />}
        </>
      )}
    </div>
  );
}
