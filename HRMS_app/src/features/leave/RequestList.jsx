import { Search } from "lucide-react";
import Pagination from "../../components/Pagination";
import { Input, Select } from "../../components/ui/field";
import { StatusPill } from "../../components/ui/status-pill";
import { countWorkingDays } from "../../lib/dates";
import { cn } from "../../lib/utils";
import useLeaveRequests from "./useLeaveRequests";
import { LEAVE_STATUSES, LEAVE_TYPES, formatRange, fullName, statusKind } from "./leaveUtils";

/**
 * Searchable list of requests (all, or the viewer's own). Rows open the
 * decision panel. scopeFilter(request) picks which requests belong here.
 */
export function RequestList({ scopeFilter, showEmployee, selectedId, onSelect, emptyMessage = "No requests match." }) {
  const { loading, error, filtered, pageItems, pagination, filters } = useLeaveRequests({ scopeFilter });
  const filtering = filters.search || filters.status !== "all" || filters.leaveType !== "all";

  return (
    <div className="grid gap-3">
      <div className="grid gap-2 md:grid-cols-[minmax(0,2fr)_repeat(3,minmax(0,1fr))]">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3" aria-hidden="true" />
          <Input
            value={filters.search}
            onChange={(e) => filters.setSearch(e.target.value)}
            placeholder={showEmployee ? "Search employee, reviewer or type…" : "Search reviewer or type…"}
            aria-label="Search requests"
            className="pl-9"
          />
        </div>
        <Select value={filters.status} onChange={(e) => filters.setStatus(e.target.value)} aria-label="Filter by status">
          <option value="all">All statuses</option>
          {LEAVE_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </Select>
        <Select value={filters.leaveType} onChange={(e) => filters.setLeaveType(e.target.value)} aria-label="Filter by leave type">
          <option value="all">All types</option>
          {LEAVE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </Select>
        <Select value={filters.sortOrder} onChange={(e) => filters.setSortOrder(e.target.value)} aria-label="Sort order">
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
        </Select>
      </div>

      <div className="flex items-center justify-between text-xs text-ink-2">
        <span className="figure">{filtered.length} request{filtered.length === 1 ? "" : "s"}</span>
        {filtering && (
          <button type="button" onClick={filters.clearFilters} className="text-teal hover:underline">
            Clear filters
          </button>
        )}
      </div>

      {error && <p role="alert" className="rounded-md border border-red/30 bg-red/10 px-3 py-2 text-sm text-red">{error}</p>}

      <div className="overflow-x-auto rounded-xl border border-line">
        <table className="w-full min-w-[560px] text-left text-[13px]">
          <thead className="border-b border-line font-mono text-[10.5px] uppercase tracking-[0.1em] text-ink-3">
            <tr>
              {showEmployee && <th scope="col" className="px-3 py-2 font-normal">Person</th>}
              <th scope="col" className="px-3 py-2 font-normal">Dates</th>
              <th scope="col" className="px-3 py-2 font-normal">Type</th>
              <th scope="col" className="px-3 py-2 font-normal">Status</th>
              <th scope="col" className="px-3 py-2 font-normal"><span className="sr-only">Open</span></th>
            </tr>
          </thead>
          <tbody>
            {loading &&
              [0, 1, 2].map((i) => (
                <tr key={i}>
                  <td colSpan={5} className="px-3 py-2"><div className="h-6 animate-pulse rounded bg-sunk" /></td>
                </tr>
              ))}
            {!loading && pageItems.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-ink-2">{emptyMessage}</td>
              </tr>
            )}
            {pageItems.map((r) => (
              <tr key={r._id} className={cn("border-t border-line", r._id === selectedId ? "bg-teal/10" : "hover:bg-sunk")}>
                {showEmployee && <td className="px-3 py-2 font-medium">{fullName(r.employeeId)}</td>}
                <td className="figure whitespace-nowrap px-3 py-2">
                  {formatRange(r.startDate, r.endDate)} <span className="text-ink-3">· {countWorkingDays(r.startDate, r.endDate)} d</span>
                </td>
                <td className="px-3 py-2 text-ink-2">{r.reason}</td>
                <td className="px-3 py-2">
                  <span className="flex flex-wrap items-center gap-1.5">
                    <StatusPill status={statusKind(r.status)}>{r.status}</StatusPill>
                    {r.counterProposal?.status === "open" && <span className="text-[11px] text-teal">new dates proposed</span>}
                  </span>
                </td>
                <td className="px-3 py-2 text-right">
                  <button type="button" onClick={() => onSelect(r._id)} className="h-8 rounded-md px-2 text-xs text-teal hover:bg-teal/10" aria-label={`Open request: ${fullName(r.employeeId)}, ${formatRange(r.startDate, r.endDate)}`}>
                    Open
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!loading && filtered.length > pagination.pageSize && <Pagination {...pagination} total={filtered.length} noun="requests" />}
    </div>
  );
}
