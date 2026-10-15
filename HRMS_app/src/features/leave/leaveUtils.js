// Mirrors Backend/constants/leave.js
export const LEAVE_TYPES = [
  "Sick Leave",
  "Vacation Leave",
  "Maternity Leave",
  "Personal Leave",
  "Emergency Leave",
  "Unpaid Leave",
];

export const LEAVE_STATUSES = [
  "Pending",
  "Manager Approved",
  "Manager Rejected",
  "Admin Approved",
  "Admin Rejected",
  "CEO Approved",
  "CEO Rejected",
];

export const IN_PROGRESS = ["Pending", "Manager Approved"];

const STATUS_COLORS = {
  Pending: "#d4a017",
  "Manager Approved": "#23A49B",
  "Admin Approved": "#22c55e",
  "CEO Approved": "#22c55e",
  "Manager Rejected": "#b91c1c",
  "Admin Rejected": "#b91c1c",
  "CEO Rejected": "#b91c1c",
};

export const statusColor = (status) => STATUS_COLORS[status] || "#6b7280";

export const formatDate = (date) =>
  date ? new Date(date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "—";

export const fullName = (user) => (user ? `${user.firstName || ""} ${user.lastName || ""}`.trim() : "—");

// Leave is counted in working days (Monday–Friday), like the backend.
export const countWorkingDays = (start, end) => {
  if (!start || !end) return 0;
  const from = new Date(start);
  const to = new Date(end);
  from.setHours(0, 0, 0, 0);
  to.setHours(0, 0, 0, 0);
  let count = 0;
  for (const d = new Date(from); d <= to; d.setDate(d.getDate() + 1)) {
    const day = d.getDay();
    if (day !== 0 && day !== 6) count++;
  }
  return count;
};

export const idOf = (ref) => (ref && typeof ref === "object" ? ref._id : ref);
