import { cn } from "../../lib/utils";
import { formatDay } from "../../lib/dates";

const CELL = {
  request: "bg-teal",
  approved: "bg-ink-3",
  pending: "border-[1.5px] border-dashed border-ink-3",
};

const LABEL = { request: "this request", approved: "approved leave", pending: "pending leave" };

/**
 * Team coverage: teammates as rows, working days as columns. This request in
 * teal, approved leave solid grey, pending dashed; days over the limit in red.
 * coverage: { days, rows, away, limit, teamSize, overLimit, othersAvailable }
 */
export function CoverageGrid({ coverage }) {
  if (!coverage) return null;
  const over = new Set(coverage.overLimit);
  return (
    <div className="grid gap-1.5">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[420px] border-separate border-spacing-[3px]" style={{ tableLayout: "fixed" }}>
          <caption className="sr-only">
            Team coverage: {coverage.rows.length} people with leave around this request, limit {coverage.limit} away per day
          </caption>
          <colgroup>
            <col style={{ width: 76 }} />
          </colgroup>
          <thead>
            <tr>
              <th scope="col" className="sr-only">Person</th>
              {coverage.days.map((d) => (
                <th
                  key={d}
                  scope="col"
                  title={`${formatDay(d, { weekday: "short", day: "numeric", month: "short" })}: ${coverage.away[coverage.days.indexOf(d)]} of ${coverage.teamSize} away`}
                  className={cn("text-center font-mono text-[10px] font-normal", over.has(d) ? "font-semibold text-red" : "text-ink-3")}
                >
                  {formatDay(d, { day: "numeric" })}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {coverage.rows.map((row) => (
              <tr key={row.id}>
                <th scope="row" className="truncate text-left text-[11.5px] font-normal text-ink-2" title={row.fullName}>
                  {row.name}
                </th>
                {row.cells.map((cell, i) => (
                  <td key={coverage.days[i]} className="p-0">
                    <span
                      className={cn("block h-[18px] rounded-[3px]", cell ? CELL[cell] : over.has(coverage.days[i]) ? "bg-red/10" : "bg-sunk")}
                      title={cell ? `${row.fullName}: ${LABEL[cell]}` : undefined}
                    >
                      {cell && <span className="sr-only">{LABEL[cell]}</span>}
                    </span>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-ink-3">
        <span className="flex items-center gap-1.5"><i className="block h-2.5 w-2.5 rounded-sm bg-teal" />this request</span>
        <span className="flex items-center gap-1.5"><i className="block h-2.5 w-2.5 rounded-sm bg-ink-3" />approved</span>
        <span className="flex items-center gap-1.5"><i className="block h-2.5 w-2.5 rounded-sm border border-dashed border-ink-3" />pending</span>
        {coverage.othersAvailable > 0 && <span>· {coverage.othersAvailable} others free all period</span>}
      </div>
    </div>
  );
}
