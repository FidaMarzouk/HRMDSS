import { useEffect, useState } from "react";
import { FaChevronLeft, FaChevronRight } from "react-icons/fa";

// Client-side pagination over an array. Resets to page 1 when `resetKey` changes.
// eslint-disable-next-line react-refresh/only-export-components
export function usePagination(items, pageSize, resetKey) {
  const [page, setPage] = useState(1);
  useEffect(() => {
    setPage(1);
  }, [resetKey]);

  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const current = Math.min(page, totalPages);
  return {
    pageItems: items.slice((current - 1) * pageSize, current * pageSize),
    pagination: { page: current, totalPages, setPage, pageSize, total: items.length },
  };
}

const Pagination = ({ page, totalPages, setPage, total, pageSize, noun = "items" }) => {
  if (!total) return null;
  const first = (page - 1) * pageSize + 1;
  const last = Math.min(page * pageSize, total);
  const navButton = (disabled) =>
    `p-2 rounded-lg ${disabled ? "bg-sunk text-ink-3 cursor-not-allowed" : "bg-teal text-on-accent hover:bg-teal-hi transition-colors"}`;

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-2 mt-4 px-2 text-ink">
      <div className="text-sm">Showing {first} to {last} of {total} {noun}</div>
      <div className="flex items-center space-x-2">
        <button type="button" aria-label="Previous page" onClick={() => setPage(page - 1)} disabled={page === 1} className={navButton(page === 1)}>
          <FaChevronLeft className="w-4 h-4" />
        </button>
        <span className="text-sm text-ink-2">Page {page} of {totalPages}</span>
        <button type="button" aria-label="Next page" onClick={() => setPage(page + 1)} disabled={page === totalPages} className={navButton(page === totalPages)}>
          <FaChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

export default Pagination;
