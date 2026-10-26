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

// Where a request stands, for the shared status pill (shape + colour).
export const statusKind = (status) => {
  if (status === "Admin Approved" || status === "CEO Approved") return "approved";
  if (String(status).endsWith("Rejected")) return "rejected";
  return "pending";
};

export const formatDate = (date) => formatDay(date);

export const fullName = (user) => (user ? `${user.firstName || ""} ${user.lastName || ""}`.trim() : "—");

// Leave is counted in working days (Monday–Friday), like the backend.
export { countWorkingDays };

export const idOf = (ref) => (ref && typeof ref === "object" ? ref._id : ref);
