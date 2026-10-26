import { countWorkingDays, formatDay } from "../../lib/dates";

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

export const formatDate = (date) => formatDay(date);

export const fullName = (user) => (user ? `${user.firstName || ""} ${user.lastName || ""}`.trim() : "—");

// Leave is counted in working days (Monday–Friday), like the backend.
export { countWorkingDays };

export const idOf = (ref) => (ref && typeof ref === "object" ? ref._id : ref);
