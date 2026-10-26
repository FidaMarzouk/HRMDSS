import { useMemo, useState } from "react";
import { FaCalendarPlus, FaRobot, FaSearch } from "react-icons/fa";
import { useAuth } from "../../context/AuthContext";
import api, { errorMessage } from "../../lib/api";
import { showError, showSuccess } from "../../lib/alerts";
import useLeaveRequests from "./useLeaveRequests";
import LeaveRequestTable from "./LeaveRequestTable";
import LeaveRequestForm from "./LeaveRequestForm";
import LeaveDecisionDialog from "./LeaveDecisionDialog";
import { IN_PROGRESS, LEAVE_STATUSES, LEAVE_TYPES, idOf } from "./leaveUtils";

/**
 * Per-role behaviour. `tabs` scope the list; `canReview` mirrors the backend's
 * authorization so buttons only appear when the action is allowed.
 */
const ROLE_CONFIG = {
  employee: {
    title: "My Leave Requests",
    canCreate: true,
    tabs: [{ key: "mine", label: "My requests", filter: () => true }],
    canReview: () => false,
  },
  manager: {
    title: "Leave Requests",
    canCreate: true,
    reviewPath: "manager",
    tabs: [
      { key: "team", label: "Team requests", filter: (r, me) => idOf(r.managerId) === me && idOf(r.employeeId) !== me },
      { key: "mine", label: "My requests", filter: (r, me) => idOf(r.employeeId) === me },
    ],
    canReview: (r, me) => idOf(r.managerId) === me && idOf(r.employeeId) !== me && r.status === "Pending",
  },
  admin: {
    title: "Leave Request Management",
    canCreate: true,
    reviewPath: "admin",
    tabs: [
      { key: "review", label: "Awaiting HR decision", filter: (r, me) => r.createdBy !== "Admin" && IN_PROGRESS.includes(r.status) && idOf(r.employeeId) !== me },
      { key: "all", label: "All requests", filter: () => true },
      { key: "mine", label: "My requests", filter: (r, me) => idOf(r.employeeId) === me },
    ],
    canReview: (r, me) => r.createdBy !== "Admin" && IN_PROGRESS.includes(r.status) && idOf(r.employeeId) !== me,
  },
  superAdmin: {
    title: "Leave Requests",
    canCreate: false,
    reviewPath: "superadmin",
    tabs: [
      { key: "review", label: "HR administrators' requests", filter: (r) => r.createdBy === "Admin" },
      { key: "all", label: "All requests", filter: () => true },
    ],
    canReview: (r) => r.createdBy === "Admin" && r.status === "Pending",
  },
};

const LeaveRequestsPage = () => {
  const { user } = useAuth();
  const me = user?.id;
  const config = ROLE_CONFIG[user?.role] || ROLE_CONFIG.employee;
  const [tabKey, setTabKey] = useState(config.tabs[0].key);
  const tab = config.tabs.find((t) => t.key === tabKey) || config.tabs[0];

  const scopeFilter = useMemo(() => (request) => tab.filter(request, me), [tab, me]);
  const { loading, error, reload, filtered, pageItems, pagination, filters } = useLeaveRequests({ scopeFilter });

  const [createOpen, setCreateOpen] = useState(false);
  const [selected, setSelected] = useState(null);
  const [action, setAction] = useState(null);
  const [busy, setBusy] = useState(false);

  const showEmployee = !(config.tabs.length === 1 || tab.key === "mine");
  const canReview = (request) => config.canReview(request, me);

  const openDetails = (request) => {
    setSelected(request);
    setAction(null);
  };
  const openDecision = (request, decision) => {
    setSelected(request);
    setAction(decision);
  };
  const closeDialog = () => {
    setSelected(null);
    setAction(null);
  };

  const confirmDecision = async () => {
    setBusy(true);
    try {
      const { data } = await api.put(`/api/leave-requests/${config.reviewPath}/${selected._id}/${action}`);
      showSuccess(action === "approve" ? "Request approved" : "Request rejected", data.message);
      closeDialog();
      reload();
    } catch (err) {
      showError("Could not update the request", errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="p-3 bg-panel flex flex-col rounded-xl border border-line shadow-lg">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
        <div className="flex items-center">
          <FaRobot className="text-teal text-xl sm:text-2xl mr-2" />
          <h1 className="text-teal text-xl sm:text-2xl font-semibold">{config.title}</h1>
        </div>
        {config.canCreate && (
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="px-3 py-2 bg-teal text-on-accent rounded flex items-center transition-all hover:bg-teal-hi shadow-lg text-sm sm:text-base w-full sm:w-auto justify-center"
          >
            <FaCalendarPlus className="mr-2" />
            Request Leave
          </button>
        )}
      </div>

      {config.tabs.length > 1 && (
        <div className="flex flex-wrap gap-2 mb-4 border-b border-line" role="tablist">
          {config.tabs.map((t) => (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={t.key === tab.key}
              onClick={() => setTabKey(t.key)}
              className={`px-4 py-2 text-sm -mb-px border-b-2 transition-colors ${
                t.key === tab.key ? "border-teal text-teal" : "border-transparent text-ink-2 hover:text-ink"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4">
        <div className="relative md:col-span-2">
          <input
            type="text"
            value={filters.search}
            onChange={(e) => filters.setSearch(e.target.value)}
            placeholder={showEmployee ? "Search by employee, reviewer or leave type…" : "Search by reviewer or leave type…"}
            className="w-full py-2 px-4 pl-10 bg-panel border border-edge rounded-lg text-ink focus:outline-none focus:ring-2 focus:ring-teal focus:border-transparent"
          />
          <FaSearch className="absolute left-3 top-3 text-ink-2" />
        </div>
        <select
          value={filters.status}
          onChange={(e) => filters.setStatus(e.target.value)}
          aria-label="Filter by status"
          className="py-2 px-3 bg-raise border border-line-2 rounded-lg text-ink text-sm"
        >
          <option value="all">All statuses</option>
          {LEAVE_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <div className="flex gap-2">
          <select
            value={filters.leaveType}
            onChange={(e) => filters.setLeaveType(e.target.value)}
            aria-label="Filter by leave type"
            className="flex-1 py-2 px-3 bg-raise border border-line-2 rounded-lg text-ink text-sm"
          >
            <option value="all">All types</option>
            {LEAVE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <select
            value={filters.sortOrder}
            onChange={(e) => filters.setSortOrder(e.target.value)}
            aria-label="Sort order"
            className="py-2 px-3 bg-raise border border-line-2 rounded-lg text-ink text-sm"
          >
            <option value="newest">Newest</option>
            <option value="oldest">Oldest</option>
          </select>
        </div>
      </div>

      <div className="mb-3 text-sm text-ink-2 flex items-center justify-between">
        <span>{filtered.length} {filtered.length === 1 ? "request" : "requests"}</span>
        {(filters.search || filters.status !== "all" || filters.leaveType !== "all") && (
          <button type="button" onClick={filters.clearFilters} className="text-teal hover:underline">
            Clear filters
          </button>
        )}
      </div>

      {error && <div className="mb-3 p-3 rounded bg-red/10 border border-red/30 text-red text-sm">{error}</div>}

      <LeaveRequestTable
        items={pageItems}
        total={filtered.length}
        loading={loading}
        pagination={pagination}
        showEmployee={showEmployee}
        canReview={canReview}
        onView={openDetails}
        onDecide={openDecision}
        emptyMessage={tab.key === "review" ? "Nothing is waiting for your decision." : undefined}
      />

      {config.canCreate && (
        <LeaveRequestForm open={createOpen} onClose={() => setCreateOpen(false)} onCreated={reload} />
      )}

      <LeaveDecisionDialog request={selected} action={action} busy={busy} onConfirm={confirmDecision} onClose={closeDialog} />
    </div>
  );
};

export default LeaveRequestsPage;
