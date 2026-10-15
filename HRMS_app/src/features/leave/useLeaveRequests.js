import { useCallback, useEffect, useMemo, useState } from "react";
import api, { errorMessage } from "../../lib/api";
import { fullName } from "./leaveUtils";

const PAGE_SIZE = 8;

// Loads leave requests visible to the current user and applies search,
// status / type filters, sorting and pagination on the client.
export default function useLeaveRequests({ scopeFilter } = {}) {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [leaveType, setLeaveType] = useState("all");
  const [sortOrder, setSortOrder] = useState("newest");
  const [page, setPage] = useState(1);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/api/leave-requests");
      setRequests(Array.isArray(data) ? data : []);
      setError(null);
    } catch (err) {
      setError(errorMessage(err, "Failed to load leave requests."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

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
