import { IN_PROGRESS, idOf } from "./leaveUtils";

// Mirrors Backend/services/policies.js: who sees which requests and who may
// decide them. Shared by the Leave page and the Today decision queue.

/**
 * Per-role behaviour. `tabs` scope the list; `canReview` mirrors the backend's
 * authorization so buttons only appear when the action is allowed.
 */
export const LEAVE_ROLE_CONFIG = {
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
