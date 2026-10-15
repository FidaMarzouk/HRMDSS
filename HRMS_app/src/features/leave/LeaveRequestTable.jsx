import { FaCheckCircle, FaEye, FaTimesCircle } from "react-icons/fa";
import Pagination from "../../components/Pagination";
import LeaveStatusBadge from "./LeaveStatusBadge";
import { countWorkingDays, formatDate, fullName } from "./leaveUtils";

const ActionButtons = ({ request, canReview, onView, onDecide, compact }) => (
  <div className="flex justify-center gap-2">
    <button
      type="button"
      onClick={() => onView(request)}
      className="px-3 py-1 text-ink rounded text-xs bg-sunk hover:bg-line transition-colors"
      aria-label="View details"
    >
      <FaEye className={compact ? "" : "mr-1 inline"} />{!compact && " View"}
    </button>
    {canReview && (
      <>
        <button
          type="button"
          onClick={() => onDecide(request, "approve")}
          className="px-3 py-1 text-on-accent rounded text-xs bg-teal hover:bg-teal-hi transition-colors"
          aria-label="Approve"
        >
          <FaCheckCircle className={compact ? "" : "mr-1 inline"} />{!compact && " Approve"}
        </button>
        <button
          type="button"
          onClick={() => onDecide(request, "reject")}
          className="px-3 py-1 text-on-accent rounded text-xs bg-red hover:bg-red/90 transition-colors"
          aria-label="Reject"
        >
          <FaTimesCircle className={compact ? "" : "mr-1 inline"} />{!compact && " Reject"}
        </button>
      </>
    )}
  </div>
);

/**
 * Responsive list of leave requests: a table on desktop, cards on mobile.
 * `showEmployee` adds the requester column; `canReview(request)` decides whether approve/reject are offered.
 */
const LeaveRequestTable = ({ items, total, loading, pagination, showEmployee, canReview, onView, onDecide, emptyMessage }) => {
  const columns = showEmployee ? 7 : 6;
  const empty = loading ? "Loading leave requests…" : emptyMessage || "No leave requests found.";

  return (
    <>
      {/* Mobile cards */}
      <div className="block sm:hidden space-y-4">
        {items.length === 0 && <div className="py-8 text-center text-ink-2">{empty}</div>}
        {items.map((request) => (
          <div key={request._id} className="bg-raise rounded-lg border border-line overflow-hidden shadow">
            <div className="p-3 border-b border-line flex justify-between items-center">
              <div className="font-medium text-ink">{showEmployee ? fullName(request.employeeId) : request.reason}</div>
              <LeaveStatusBadge status={request.status} />
            </div>
            <dl className="p-3 space-y-2 text-sm">
              {showEmployee && (
                <div className="flex justify-between"><dt className="text-ink-2">Type</dt><dd className="text-ink">{request.reason}</dd></div>
              )}
              <div className="flex justify-between"><dt className="text-ink-2">From</dt><dd className="text-ink">{formatDate(request.startDate)}</dd></div>
              <div className="flex justify-between"><dt className="text-ink-2">To</dt><dd className="text-ink">{formatDate(request.endDate)}</dd></div>
              <div className="flex justify-between"><dt className="text-ink-2">Working days</dt><dd className="text-ink">{countWorkingDays(request.startDate, request.endDate)}</dd></div>
              <div className="flex justify-between"><dt className="text-ink-2">Reviewer</dt><dd className="text-ink text-right">{fullName(request.managerId)}</dd></div>
            </dl>
            <div className="bg-panel p-3">
              <ActionButtons request={request} canReview={canReview(request)} onView={onView} onDecide={onDecide} compact />
            </div>
          </div>
        ))}
      </div>

      {/* Desktop table */}
      <div className="hidden sm:block w-full overflow-x-auto mt-1 rounded-lg bg-raise shadow-inner border border-line">
        <table className="table-auto w-full text-left border-separate border-spacing-y-1">
          <thead className="bg-raise sticky top-0">
            <tr>
              {showEmployee && <th className="py-3 px-3 text-teal text-sm font-bold">Employee</th>}
              <th className="py-3 px-3 text-teal text-sm font-bold">Reviewer</th>
              <th className="py-3 px-3 text-teal text-sm font-bold">From</th>
              <th className="py-3 px-3 text-teal text-sm font-bold">To</th>
              <th className="py-3 px-3 text-teal text-sm font-bold">Type</th>
              <th className="py-3 px-3 text-teal text-sm font-bold text-center">Status</th>
              <th className="py-3 px-3 text-teal text-sm font-bold text-center">Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 && (
              <tr className="bg-raise">
                <td colSpan={columns} className="py-4 px-3 text-sm text-center text-ink-2">{empty}</td>
              </tr>
            )}
            {items.map((request) => (
              <tr key={request._id} className="bg-raise hover:bg-sunk transition-colors">
                {showEmployee && <td className="py-4 px-3 text-sm text-ink font-medium">{fullName(request.employeeId)}</td>}
                <td className="py-4 px-3 text-sm text-ink">{fullName(request.managerId)}</td>
                <td className="py-4 px-3 text-sm text-ink">{formatDate(request.startDate)}</td>
                <td className="py-4 px-3 text-sm text-ink">{formatDate(request.endDate)}</td>
                <td className="py-4 px-3 text-sm text-ink">{request.reason}</td>
                <td className="py-4 px-3 text-sm text-center"><LeaveStatusBadge status={request.status} /></td>
                <td className="py-4 px-3 text-sm text-center">
                  <ActionButtons request={request} canReview={canReview(request)} onView={onView} onDecide={onDecide} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Pagination {...pagination} total={total} noun="requests" />
    </>
  );
};

export default LeaveRequestTable;
