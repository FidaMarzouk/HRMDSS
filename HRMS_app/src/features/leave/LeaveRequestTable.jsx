import { FaCheckCircle, FaEye, FaTimesCircle } from "react-icons/fa";
import Pagination from "../../components/Pagination";
import LeaveStatusBadge from "./LeaveStatusBadge";
import { countWorkingDays, formatDate, fullName } from "./leaveUtils";

const ActionButtons = ({ request, canReview, onView, onDecide, compact }) => (
  <div className="flex justify-center gap-2">
    <button
      type="button"
      onClick={() => onView(request)}
      className="px-3 py-1 text-white rounded text-xs bg-[#444] hover:bg-[#555] transition-colors"
      aria-label="View details"
    >
      <FaEye className={compact ? "" : "mr-1 inline"} />{!compact && " View"}
    </button>
    {canReview && (
      <>
        <button
          type="button"
          onClick={() => onDecide(request, "approve")}
          className="px-3 py-1 text-white rounded text-xs bg-[#33adb4] hover:bg-[#2a8c92] transition-colors"
          aria-label="Approve"
        >
          <FaCheckCircle className={compact ? "" : "mr-1 inline"} />{!compact && " Approve"}
        </button>
        <button
          type="button"
          onClick={() => onDecide(request, "reject")}
          className="px-3 py-1 text-white rounded text-xs bg-[#b91c1c] hover:bg-[#991b1b] transition-colors"
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
        {items.length === 0 && <div className="py-8 text-center text-gray-400">{empty}</div>}
        {items.map((request) => (
          <div key={request._id} className="bg-[#222] rounded-lg border border-[#333] overflow-hidden shadow">
            <div className="p-3 border-b border-[#333] flex justify-between items-center">
              <div className="font-medium text-white">{showEmployee ? fullName(request.employeeId) : request.reason}</div>
              <LeaveStatusBadge status={request.status} />
            </div>
            <dl className="p-3 space-y-2 text-sm">
              {showEmployee && (
                <div className="flex justify-between"><dt className="text-gray-400">Type</dt><dd className="text-gray-300">{request.reason}</dd></div>
              )}
              <div className="flex justify-between"><dt className="text-gray-400">From</dt><dd className="text-gray-300">{formatDate(request.startDate)}</dd></div>
              <div className="flex justify-between"><dt className="text-gray-400">To</dt><dd className="text-gray-300">{formatDate(request.endDate)}</dd></div>
              <div className="flex justify-between"><dt className="text-gray-400">Working days</dt><dd className="text-gray-300">{countWorkingDays(request.startDate, request.endDate)}</dd></div>
              <div className="flex justify-between"><dt className="text-gray-400">Reviewer</dt><dd className="text-gray-300 text-right">{fullName(request.managerId)}</dd></div>
            </dl>
            <div className="bg-[#1a1a1a] p-3">
              <ActionButtons request={request} canReview={canReview(request)} onView={onView} onDecide={onDecide} compact />
            </div>
          </div>
        ))}
      </div>

      {/* Desktop table */}
      <div className="hidden sm:block w-full overflow-x-auto mt-1 rounded-lg bg-[#222] shadow-inner border border-[#333]">
        <table className="table-auto w-full text-left border-separate border-spacing-y-1">
          <thead className="bg-[#2c2c2c] sticky top-0">
            <tr>
              {showEmployee && <th className="py-3 px-3 text-[#33adb4] text-sm font-bold">Employee</th>}
              <th className="py-3 px-3 text-[#33adb4] text-sm font-bold">Reviewer</th>
              <th className="py-3 px-3 text-[#33adb4] text-sm font-bold">From</th>
              <th className="py-3 px-3 text-[#33adb4] text-sm font-bold">To</th>
              <th className="py-3 px-3 text-[#33adb4] text-sm font-bold">Type</th>
              <th className="py-3 px-3 text-[#33adb4] text-sm font-bold text-center">Status</th>
              <th className="py-3 px-3 text-[#33adb4] text-sm font-bold text-center">Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 && (
              <tr className="bg-[#2a2a2a]">
                <td colSpan={columns} className="py-4 px-3 text-sm text-center text-gray-400">{empty}</td>
              </tr>
            )}
            {items.map((request) => (
              <tr key={request._id} className="bg-[#2a2a2a] hover:bg-[#333] transition-colors">
                {showEmployee && <td className="py-4 px-3 text-sm text-white font-medium">{fullName(request.employeeId)}</td>}
                <td className="py-4 px-3 text-sm text-gray-300">{fullName(request.managerId)}</td>
                <td className="py-4 px-3 text-sm text-gray-300">{formatDate(request.startDate)}</td>
                <td className="py-4 px-3 text-sm text-gray-300">{formatDate(request.endDate)}</td>
                <td className="py-4 px-3 text-sm text-gray-300">{request.reason}</td>
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
