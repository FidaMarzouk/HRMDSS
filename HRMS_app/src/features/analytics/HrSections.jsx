import { MarkFrame } from "../../components/marks/MarkFrame";
import { Figure, Meter, ProportionStrip, RankedBars, StackedRows } from "../../components/marks/Bars";
import { Columns, HeatStrip } from "../../components/marks/Columns";
import { TONE, fmt } from "../../components/marks/palette";
import { formatDay } from "../../lib/dates";

// The sections of the former HR dashboard, drawn with the Pulse marks (tabs in tabs.js).

const RESOURCE_TYPES = { robot: "Robots", prototype: "Prototypes", meetingRoom: "Meeting rooms", desktop: "Desktops", office: "Offices", toolKit: "Tool kits", testingEquipment: "Testing equipment" };
const NOTIFICATION_TYPES = {
  leave_request: "Leave requests",
  leave_approved: "Leave approvals",
  leave_rejected: "Leave rejections",
  leave_counter_proposal: "Counter-proposals",
  attendance_correction: "Time corrections",
  event: "Event updates",
  event_invitation: "Event invitations",
  event_response: "Event responses",
};
const resourceLabel = (t) => RESOURCE_TYPES[t] || t;
const shortDay = (d) => formatDay(d, { day: "numeric", month: "short" });
const monthLabel = (period) => {
  const [y, m] = period.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-GB", { month: "short", year: "2-digit", timeZone: "UTC" });
};
const Grid = ({ children }) => <div className="grid gap-4 lg:grid-cols-2">{children}</div>;
const Figures = ({ children }) => <div className="grid gap-3 sm:grid-cols-3">{children}</div>;

function Attendance({ data }) {
  const a = data.attendanceAnalytics;
  return (
    <Grid>
      <MarkFrame
        title="Attendance by Department"
        summary="Share of attendance records that were present, late or absent."
        empty={!a.attendanceByDepartment.length}
        table={{
          columns: [
            { key: "departmentName", label: "Department" },
            { key: "totalAttendances", label: "Records", align: "right" },
            { key: "presentPercentage", label: "Present", align: "right", format: fmt.pct },
            { key: "latePercentage", label: "Late", align: "right", format: fmt.pct },
            { key: "absentPercentage", label: "Absent", align: "right", format: fmt.pct },
          ],
          rows: a.attendanceByDepartment,
        }}
      >
        <StackedRows
          rows={a.attendanceByDepartment.map((d) => ({ id: d.departmentName, label: d.departmentName, parts: [{ value: d.presentPercentage }, { value: d.latePercentage }, { value: d.absentPercentage }] }))}
          series={[{ label: "Present", color: TONE.teal }, { label: "Late", color: TONE.amber }, { label: "Absent", color: TONE.red }]}
        />
      </MarkFrame>
      <MarkFrame
        title="Absenteeism Trend"
        summary="Absence records per day."
        empty={!a.absenteeismTrend.length}
        table={{ columns: [{ key: "date", label: "Day", format: shortDay }, { key: "count", label: "Absences", align: "right" }], rows: a.absenteeismTrend }}
      >
        <Columns data={a.absenteeismTrend.map((d) => ({ key: d.date, label: shortDay(d.date), count: d.count }))} series={[{ key: "count", label: "Absences", color: TONE.red }]} />
      </MarkFrame>
      <MarkFrame
        title="Late Arrivals by Department"
        empty={!a.lateArrivalsByDepartment.length}
        table={{
          columns: [
            { key: "departmentName", label: "Department" },
            { key: "totalLate", label: "Late arrivals", align: "right" },
            { key: "averageLateMinutes", label: "Avg minutes late", align: "right", format: fmt.one },
          ],
          rows: a.lateArrivalsByDepartment,
        }}
      >
        <RankedBars color={TONE.amber} items={a.lateArrivalsByDepartment.map((d) => ({ label: d.departmentName, value: d.totalLate, note: `avg ${fmt.int(d.averageLateMinutes)} min` }))} />
      </MarkFrame>
      <MarkFrame
        title="Overtime by Department"
        empty={!a.overtimeDistribution.length}
        table={{
          columns: [
            { key: "departmentName", label: "Department" },
            { key: "totalOvertimeHours", label: "Overtime", align: "right", format: fmt.hours },
            { key: "employeeCount", label: "People", align: "right" },
          ],
          rows: a.overtimeDistribution,
        }}
      >
        <RankedBars format={fmt.hours} items={a.overtimeDistribution.map((d) => ({ label: d.departmentName, value: d.totalOvertimeHours, note: `${d.employeeCount} people` }))} />
      </MarkFrame>
    </Grid>
  );
}

function Leave({ data }) {
  const l = data.leaveManagement;
  const u = l.leaveDaysUsageStats;
  return (
    <div className="grid gap-4">
      <Figures>
        <Figure label="Leave requests in progress" value={fmt.int(data.overview.pendingLeaveRequests)} detail="pending or waiting on HR" />
        <Figure label="Leave days used" value={fmt.int(u.totalUsed)} detail={`of ${fmt.int(u.totalAllowed)} allowed`} />
        <Figure label="Leave days remaining" value={fmt.int(u.totalRemaining)} detail="across the workforce" />
      </Figures>
      <Grid>
        <MarkFrame
          title="Leave Status"
          summary="All leave requests by status."
          empty={!l.leaveStatusDistribution.length}
          table={{ columns: [{ key: "status", label: "Status" }, { key: "count", label: "Requests", align: "right" }], rows: l.leaveStatusDistribution }}
        >
          <RankedBars items={l.leaveStatusDistribution.map((s) => ({ label: s.status, value: s.count, color: /Rejected/.test(s.status) ? TONE.red : /Approved/.test(s.status) ? TONE.teal : TONE.blue }))} />
        </MarkFrame>
        <MarkFrame
          title="Leave Days Usage"
          table={{ columns: [{ key: "k", label: "Measure" }, { key: "v", label: "Days", align: "right" }], rows: [{ k: "Allowed", v: u.totalAllowed }, { k: "Used", v: u.totalUsed }, { k: "Remaining", v: u.totalRemaining }, { k: "Usage", v: fmt.pct(u.usagePercentage) }] }}
        >
          <Meter label="Used of allowed" value={u.totalUsed} max={u.totalAllowed || 1} valueText={fmt.pct(u.usagePercentage)} />
          <ProportionStrip parts={[{ label: "Used", value: u.totalUsed, color: TONE.teal }, { label: "Remaining", value: u.totalRemaining, color: TONE.line2 }]} />
        </MarkFrame>
        <MarkFrame
          title="Leave Types"
          summary="All leave requests by type."
          empty={!l.leaveTypeDistribution.length}
          table={{ columns: [{ key: "leaveType", label: "Type" }, { key: "count", label: "Requests", align: "right" }], rows: l.leaveTypeDistribution }}
        >
          <ProportionStrip parts={l.leaveTypeDistribution.map((t) => ({ label: t.leaveType, value: t.count }))} />
        </MarkFrame>
        <MarkFrame
          title="Leave Seasonal Patterns"
          summary="Requests and requested days by start month, from a year ago (future months hold requests already made)."
          empty={!l.leaveSeasonalPatterns.length}
          table={{ columns: [{ key: "period", label: "Month", format: monthLabel }, { key: "totalRequests", label: "Requests", align: "right" }, { key: "totalDays", label: "Days", align: "right" }], rows: l.leaveSeasonalPatterns }}
        >
          <Columns
            data={l.leaveSeasonalPatterns.map((p) => ({ key: p.period, label: monthLabel(p.period), totalRequests: p.totalRequests, totalDays: p.totalDays }))}
            series={[{ key: "totalRequests", label: "Requests" }, { key: "totalDays", label: "Days" }]}
            labelEvery={1}
          />
        </MarkFrame>
      </Grid>
    </div>
  );
}

function Workforce({ data }) {
  const w = data.workforceAnalytics;
  const h = w.headcountTrend;
  const r = w.managerEmployeeRatio;
  return (
    <div className="grid gap-4">
      <Figures>
        <Figure label="Employees" value={fmt.int(data.overview.totalEmployees)} detail="active, CEO not counted" />
        <Figure label="Departments" value={fmt.int(data.overview.totalDepartments)} />
        <Figure label="Manager-employee ratio" value={`1 : ${fmt.one(r.ratio)}`} detail={`${r.managerCount} managers · ${r.employeeCount} employees`} />
      </Figures>
      <Grid>
        <MarkFrame
          title="Employees by Department"
          empty={!w.employeesByDepartment.length}
          table={{ columns: [{ key: "name", label: "Department" }, { key: "employeeCount", label: "People", align: "right" }], rows: w.employeesByDepartment }}
        >
          <RankedBars items={w.employeesByDepartment.map((d) => ({ label: d.name, value: d.employeeCount }))} />
        </MarkFrame>
        <MarkFrame
          title="Salary Distribution"
          summary="Monthly salary bands, active workforce."
          table={{ columns: [{ key: "range", label: "Band" }, { key: "count", label: "People", align: "right" }], rows: w.salaryDistribution }}
        >
          <Columns data={w.salaryDistribution.map((b) => ({ key: b.range, label: b.range, short: b.range.replace(" DT", "").replace(" and above", "+").replace("Under ", "<"), count: b.count }))} series={[{ key: "count", label: "People" }]} labelEvery={1} />
          <p className="text-[11px] text-ink-3">Amounts in Tunisian dinars (DT).</p>
        </MarkFrame>
        <MarkFrame
          title="Manager-Employee Ratio"
          table={{ columns: [{ key: "k", label: "Role" }, { key: "v", label: "People", align: "right" }], rows: [{ k: "Managers", v: r.managerCount }, { k: "Employees", v: r.employeeCount }] }}
        >
          <p className="figure text-2xl text-ink">1 : {fmt.one(r.ratio)}</p>
          <ProportionStrip parts={[{ label: "Managers", value: r.managerCount, color: TONE.teal }, { label: "Employees", value: r.employeeCount, color: TONE.blue }]} />
        </MarkFrame>
        <MarkFrame
          title="Headcount & Growth"
          table={{ columns: [{ key: "k", label: "Measure" }, { key: "v", label: "Value", align: "right" }], rows: [{ k: "Current headcount", v: h.currentHeadcount }, { k: "New hires in the period", v: h.newHires }, { k: "Growth", v: fmt.pct(h.growth) }] }}
        >
          <div className="flex items-baseline gap-3">
            <p className="figure text-2xl text-ink">{fmt.int(h.currentHeadcount)}</p>
            <p className={h.growth > 0 ? "figure text-[13px] text-teal" : "figure text-[13px] text-ink-3"}>{h.growth > 0 ? "▲" : ""} {fmt.pct(h.growth)} growth</p>
          </div>
          <Meter label="New hires in the period" value={h.newHires} max={h.currentHeadcount || 1} valueText={`${h.newHires} · ${fmt.pct(h.currentHeadcount ? (h.newHires / h.currentHeadcount) * 100 : 0)} of workforce`} />
        </MarkFrame>
      </Grid>
    </div>
  );
}

function Resources({ data }) {
  const r = data.resourceManagement;
  const sum = (k) => r.resourceUtilization.reduce((n, x) => n + (x[k] || 0), 0);
  return (
    <div className="grid gap-4">
      <Figures>
        <Figure label="Resources" value={fmt.int(sum("totalResources"))} />
        <Figure label="Available" value={fmt.int(sum("availableResources"))} />
        <Figure label="Reservations" value={fmt.int(sum("totalReservations"))} />
      </Figures>
      <Grid>
        <MarkFrame
          title="Resource Utilization"
          summary="Reservations per resource, by type."
          empty={!r.resourceUtilization.length}
          table={{
            columns: [
              { key: "resourceType", label: "Type", format: resourceLabel },
              { key: "totalResources", label: "Resources", align: "right" },
              { key: "availableResources", label: "Available", align: "right" },
              { key: "totalReservations", label: "Reservations", align: "right" },
              { key: "utilizationRate", label: "Per resource", align: "right", format: fmt.one },
            ],
            rows: r.resourceUtilization,
          }}
        >
          <RankedBars format={fmt.one} items={r.resourceUtilization.map((x) => ({ label: resourceLabel(x.resourceType), value: x.utilizationRate, note: `${x.availableResources}/${x.totalResources} free` }))} />
        </MarkFrame>
        <MarkFrame
          title="Maintenance by Resource Type"
          empty={!r.maintenanceByResourceType.length}
          emptyText="No resource is under maintenance."
          table={{ columns: [{ key: "resourceName", label: "Resource" }, { key: "resourceType", label: "Type", format: resourceLabel }, { key: "maintenanceCount", label: "Under maintenance", align: "right" }], rows: r.maintenanceByResourceType }}
        >
          <RankedBars color={TONE.amber} items={r.maintenanceByResourceType.map((x) => ({ label: x.resourceName || resourceLabel(x.resourceType), value: x.maintenanceCount, note: resourceLabel(x.resourceType) }))} />
        </MarkFrame>
        <MarkFrame
          title="Most Requested Resources"
          empty={!r.mostRequestedResources.length}
          table={{ columns: [{ key: "resourceName", label: "Resource" }, { key: "resourceType", label: "Type", format: resourceLabel }, { key: "reservationCount", label: "Reservations", align: "right" }], rows: r.mostRequestedResources }}
        >
          <RankedBars items={r.mostRequestedResources.map((x) => ({ label: x.resourceName, value: x.reservationCount, note: resourceLabel(x.resourceType) }))} labelWidth={180} />
        </MarkFrame>
      </Grid>
    </div>
  );
}

function Communication({ data }) {
  const c = data.communicationAnalytics;
  const totalSent = c.notificationRatesByType.reduce((n, t) => n + t.total, 0);
  const totalRead = c.notificationRatesByType.reduce((n, t) => n + t.read, 0);
  return (
    <div className="grid gap-4">
      <Figures>
        <Figure label="Messages" value={fmt.int(c.messagesByDepartment.reduce((n, d) => n + d.messageCount, 0))} />
        <Figure label="Average response time" value={`${fmt.int(c.averageResponseTime?.averageResponseTime || 0)} min`} detail={`${c.averageResponseTime?.responseCount || 0} replies measured`} />
        <Figure label="Notification read rate" value={fmt.pct(totalSent ? (totalRead / totalSent) * 100 : null)} detail={`${totalRead} of ${totalSent} read`} />
      </Figures>
      <Grid>
        <MarkFrame
          title="Messages by Department"
          empty={!c.messagesByDepartment.length}
          table={{ columns: [{ key: "departmentName", label: "Department" }, { key: "messageCount", label: "Messages", align: "right" }, { key: "uniqueSendersCount", label: "Senders", align: "right" }], rows: c.messagesByDepartment }}
        >
          <RankedBars items={c.messagesByDepartment.map((d) => ({ label: d.departmentName, value: d.messageCount, note: `${d.uniqueSendersCount} senders` }))} />
        </MarkFrame>
        <MarkFrame
          title="Peak Communication Times"
          summary="Messages by hour of the day."
          table={{ columns: [{ key: "timeLabel", label: "Hour" }, { key: "messageCount", label: "Messages", align: "right" }], rows: c.peakCommunicationTimes }}
        >
          <HeatStrip cells={c.peakCommunicationTimes.map((h) => ({ key: h.hour, label: h.timeLabel, short: String(h.hour).padStart(2, "0"), value: h.messageCount }))} />
        </MarkFrame>
        <MarkFrame
          title="Response Time Distribution"
          empty={!c.averageResponseTime?.responseTimeDistribution?.length}
          table={{ columns: [{ key: "range", label: "Response time" }, { key: "count", label: "Replies", align: "right" }], rows: c.averageResponseTime?.responseTimeDistribution || [] }}
        >
          <RankedBars sort={false} items={(c.averageResponseTime?.responseTimeDistribution || []).map((b) => ({ label: b.range, value: b.count }))} />
        </MarkFrame>
        <MarkFrame
          title="Notification Read Rates"
          empty={!c.notificationRatesByType.length}
          table={{
            columns: [
              { key: "notificationType", label: "Type", format: (t) => NOTIFICATION_TYPES[t] || t },
              { key: "read", label: "Read", align: "right" },
              { key: "total", label: "Sent", align: "right" },
              { key: "readRate", label: "Read rate", align: "right", format: fmt.pct },
            ],
            rows: c.notificationRatesByType,
          }}
        >
          <div className="grid gap-2.5">
            {c.notificationRatesByType.map((t) => (
              <Meter key={t.notificationType} label={NOTIFICATION_TYPES[t.notificationType] || t.notificationType} value={t.readRate} valueText={`${fmt.pct(t.readRate)} · ${t.read}/${t.total}`} color={t.readRate < 30 ? TONE.amber : TONE.teal} />
            ))}
          </div>
        </MarkFrame>
      </Grid>
    </div>
  );
}

const SECTIONS = { attendance: Attendance, leave: Leave, workforce: Workforce, resources: Resources, communication: Communication };

export function HrSection({ tab, data }) {
  const Section = SECTIONS[tab] || Attendance;
  return <Section data={data} />;
}
