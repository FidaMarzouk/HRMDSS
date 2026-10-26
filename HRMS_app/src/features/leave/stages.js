import { idOf } from "./leaveUtils";
import { LEAVE_ROLE_CONFIG } from "./leavePolicy";

const FINAL_APPROVED = ["Admin Approved", "CEO Approved"];
const REJECTED = ["Manager Rejected", "Admin Rejected", "CEO Rejected"];
const CLOSED_DAYS = 14;

const startOfToday = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};

/**
 * Where a request sits for the person looking at it:
 *  yours     waiting on this viewer's decision
 *  others    in progress, waiting on someone else in the chain
 *  employee  a counter-proposal waits on the employee's answer
 *  scheduled final approval, not yet over
 *  closed    rejected, or approved and over
 */
export function stageOf(request, viewer) {
  if (request.counterProposal?.status === "open") return "employee";
  if (FINAL_APPROVED.includes(request.status)) return new Date(request.endDate) >= startOfToday() ? "scheduled" : "closed";
  if (REJECTED.includes(request.status)) return "closed";
  const config = LEAVE_ROLE_CONFIG[viewer.role];
  return config?.canReview(request, viewer.id) ? "yours" : "others";
}

const OTHERS_LABEL = { admin: "Waiting on manager", manager: "Waiting on HR", superAdmin: "Waiting on others" };

export const pipelineColumns = (role) => [
  { key: "others", label: OTHERS_LABEL[role] || "Waiting on others" },
  { key: "yours", label: "Your decision", highlight: true },
  { key: "employee", label: "Waiting on employee" },
  { key: "scheduled", label: "Scheduled" },
  { key: "closed", label: `Closed · ${CLOSED_DAYS} days` },
];

/**
 * Group the viewer's pipeline (their own requests excluded; those are in "My requests").
 * Closed requests are limited to the last two weeks; columns are sorted by start date,
 * except Closed (most recently changed first).
 */
export function buildPipeline(requests, viewer) {
  const since = Date.now() - CLOSED_DAYS * 24 * 60 * 60 * 1000;
  const groups = { others: [], yours: [], employee: [], scheduled: [], closed: [] };
  requests
    .filter((r) => idOf(r.employeeId) !== viewer.id)
    .forEach((r) => {
      const stage = stageOf(r, viewer);
      if (stage === "closed" && new Date(r.updatedAt || r.createdAt) < since) return;
      groups[stage].push(r);
    });
  Object.entries(groups).forEach(([key, list]) =>
    list.sort((a, b) => (key === "closed" ? new Date(b.updatedAt) - new Date(a.updatedAt) : new Date(a.startDate) - new Date(b.startDate)))
  );
  return groups;
}
