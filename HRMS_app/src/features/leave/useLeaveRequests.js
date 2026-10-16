import { useEffect, useMemo, useState } from "react";
import { errorMessage } from "../../lib/api";
import { useLeaveList } from "./leaveApi";
import { fullName } from "./leaveUtils";

const PAGE_SIZE = 8;

// Leave requests visible to the current user (shared query, refreshed after
// every decision), with search, status / type filters, sorting and pagination
// on the client.
export default function useLeaveRequests({ scopeFilter } = {}) {
  const list = useLeaveList();
  const requests = useMemo(() => (Array.isArray(list.data) ? list.data : []), [list.data]);
  const loading = list.isLoading;
  const error = list.isError ? errorMessage(list.error, "Failed to load leave requests.") : null;
  const reload = list.refetch;
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [leaveType, setLeaveType] = useState("all");
  const [sortOrder, setSortOrder] = useState("newest");
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return requests
      .filter((r) => (scopeFilter ? scopeFilter(r) : true))
      .filter((r) => status === "all" || r.status === status)
      .filter((r) => leaveType === "all" || r.reason === leaveType)
      .filter((r) => {
        if (!query) return true;
        return [fullName(r.employeeId), fullName(r.managerId), r.reason]
          .some((value) => (value || "").toLowerCase().includes(query));
      })
      .sort((a, b) => {
        const diff = new Date(b.createdAt || b.startDate) - new Date(a.createdAt || a.startDate);
        return sortOrder === "newest" ? diff : -diff;
      });
  }, [requests, scopeFilter, status, leaveType, search, sortOrder]);

  // Back to the first page whenever the filters change.
  useEffect(() => {
    setPage(1);
  }, [scopeFilter, status, leaveType, search, sortOrder]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageItems = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const clearFilters = () => {
    setSearch("");
    setStatus("all");
    setLeaveType("all");
    setSortOrder("newest");
  };

  return {
    loading,
    error,
    reload,
    filtered,
    pageItems,
    pagination: { page: currentPage, totalPages, setPage, pageSize: PAGE_SIZE },
    filters: { search, setSearch, status, setStatus, leaveType, setLeaveType, sortOrder, setSortOrder, clearFilters },
  };
}
