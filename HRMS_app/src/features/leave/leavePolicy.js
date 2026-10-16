import { IN_PROGRESS, idOf } from "./leaveUtils";

// Mirrors Backend/services/policies.js: who may decide which requests, and
// which views each role gets on the Leave page. Shared by the Leave page, the
// pipeline stages and the Today queue.
//
// views: "pipeline" (requests by stage), "all" (searchable list), "mine".
// canReview(request, myId) matches the backend checks, so buttons only appear
// when the action is allowed.
export const LEAVE_ROLE_CONFIG = {
  employee: {
    canCreate: true,
    views: ["mine"],
    canReview: () => false,
  },
  manager: {
    canCreate: true,
    reviewPath: "manager",
    views: ["pipeline", "all", "mine"],
    canReview: (r, me) => idOf(r.managerId) === me && idOf(r.employeeId) !== me && r.status === "Pending",
  },
  admin: {
    canCreate: true,
    reviewPath: "admin",
    views: ["pipeline", "all", "mine"],
    canReview: (r, me) => r.createdBy !== "Admin" && IN_PROGRESS.includes(r.status) && idOf(r.employeeId) !== me,
  },
  superAdmin: {
    canCreate: false,
    reviewPath: "superadmin",
    views: ["pipeline", "all"],
    canReview: (r) => r.createdBy === "Admin" && r.status === "Pending",
  },
};

export const VIEW_LABELS = { pipeline: "Pipeline", all: "All requests", mine: "My requests" };
