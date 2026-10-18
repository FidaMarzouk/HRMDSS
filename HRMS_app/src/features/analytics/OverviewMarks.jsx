import { MarkFrame } from "../../components/marks/MarkFrame";
import { Swarm } from "../../components/marks/Swarm";
import { Barcode } from "../../components/marks/Barcode";
import { Tide } from "../../components/marks/Tide";
import { HoursBudget } from "../../components/marks/HoursBudget";
import { Ticker } from "../../components/marks/Ticker";
import { fmt } from "../../components/marks/palette";
import { formatDay } from "../../lib/dates";

// Targets drawn on the tickers. Punctuality follows the concept board (80 %).
const TARGETS = { attendance: 95, punctuality: 80 };

export function Tickers({ tickers, compare, loading }) {
  const t = tickers || {};
  const prev = (x) => (compare ? x?.previous : undefined);
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Ticker label="Attendance rate" unit="%" value={t.attendanceRate?.value} previous={prev(t.attendanceRate)} daily={t.attendanceRate?.daily} target={TARGETS.attendance} why="#barcode" loading={loading} />
      <Ticker label="Punctuality" unit="%" value={t.punctuality?.value} previous={prev(t.punctuality)} daily={t.punctuality?.daily} target={TARGETS.punctuality} why="#arrivals" loading={loading} detail="on-time share of arrivals" />
      <Ticker label="Overtime" unit="h" better="down" value={t.overtimeHours?.value} previous={prev(t.overtimeHours)} daily={t.overtimeHours?.daily} why="#hours" loading={loading} />
      <Ticker label="Absences" better="down" value={t.absences?.value} previous={prev(t.absences)} why="#barcode" loading={loading} detail="person-days without leave" />
    </div>
  );
}

export function OverviewMarks({ data, compare }) {
  const arrivals = compare ? data.arrivals : data.arrivals.map((g) => ({ ...g, medianPrevious: null, latePrevious: 0 }));
  const peakDay = data.tide.peak?.total ? `peak ${data.tide.peak.total} on ${formatDay(data.tide.peak.date, { weekday: "short", day: "numeric", month: "short" })}` : "no leave planned";
  const overDepartments = data.tide.departments.filter((d) => d.overLimit.length);

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <MarkFrame
        id="arrivals"
        kicker="Arrivals"
        title="Arrival swarm"
        summary="First punch-in of each person-day, by department."
        empty={!arrivals.length}
        table={{
          columns: [
            { key: "name", label: "Department" },
            { key: "count", label: "Arrivals", align: "right" },
            { key: "medianCurrent", label: "Median", align: "right", format: fmt.clock },
            { key: "medianPrevious", label: "Prev. median", align: "right", format: fmt.clock },
            { key: "lateCurrent", label: "Late", align: "right" },
            { key: "latePrevious", label: "Prev. late", align: "right" },
          ],
          rows: data.arrivals.map((g) => ({ ...g, count: g.current.length })),
        }}
      >
        <Swarm groups={arrivals} />
      </MarkFrame>

      <MarkFrame
        id="barcode"
        kicker="Attendance"
        title="Attendance barcode"
        summary={`${data.barcode.days.length} working days · rate excludes leave.`}
        empty={!data.barcode.rows.length || !data.barcode.days.length}
        table={{
          columns: [
            { key: "name", label: "Person" },
            { key: "department", label: "Department" },
            { key: "present", label: "Present", align: "right" },
            { key: "late", label: "Late", align: "right" },
            { key: "absent", label: "Absent", align: "right" },
            { key: "leave", label: "Leave", align: "right" },
            { key: "rate", label: "Rate", align: "right", format: fmt.pct },
          ],
          rows: data.barcode.rows.map((r) => ({
            ...r,
            present: r.cells.filter((c) => c === "present").length,
            late: r.cells.filter((c) => c === "late").length,
            absent: r.cells.filter((c) => c === "absent").length,
            leave: r.cells.filter((c) => c === "leave").length,
          })),
        }}
      >
        <Barcode days={data.barcode.days} rows={data.barcode.rows} />
      </MarkFrame>

      <MarkFrame
        id="tide"
        kicker="Coverage"
        title="Leave tide"
        summary={`Next ${data.tide.columns.length} working days · ${peakDay}.`}
        table={{
          columns: [
            { key: "date", label: "Day", format: (v) => formatDay(v, { weekday: "short", day: "numeric", month: "short" }) },
            { key: "approved", label: "Approved", align: "right" },
            { key: "pending", label: "Pending", align: "right" },
            { key: "total", label: "Away", align: "right" },
          ],
          rows: data.tide.columns.map((c) => ({ ...c, id: c.date })),
        }}
      >
        <Tide columns={data.tide.columns} limit={data.tide.limit} peak={data.tide.peak} />
        <p className="text-[12px] text-ink-2">
          {overDepartments.length
            ? `Over their own limit: ${overDepartments.map((d) => `${d.name} (${d.overLimit.length} day${d.overLimit.length === 1 ? "" : "s"}, limit ${d.limit})`).join("; ")}.`
            : `No department goes over its own coverage limit${data.tide.departments.length > 1 ? " (the line is the sum of department limits)" : ""}.`}
        </p>
      </MarkFrame>

      <MarkFrame
        id="hours"
        kicker="Hours"
        title="Hours budget by department"
        summary="Production hours against 8 h 30 per expected day (leave excluded)."
        empty={!data.hours.length}
        table={{
          columns: [
            { key: "name", label: "Department" },
            { key: "headcount", label: "People", align: "right" },
            { key: "worked", label: "Worked", align: "right", format: fmt.hours },
            { key: "contracted", label: "Contracted", align: "right", format: fmt.hours },
            { key: "overtime", label: "Overtime", align: "right", format: fmt.hours },
            { key: "delta", label: "Difference", align: "right", format: fmt.hours },
          ],
          rows: data.hours,
        }}
      >
        <HoursBudget rows={data.hours} />
      </MarkFrame>
    </div>
  );
}
