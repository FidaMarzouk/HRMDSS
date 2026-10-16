import { formatDay } from "../../lib/dates";

export const ROLE_LABELS = {
  employee: "Employee",
  manager: "Manager",
  admin: "HR Administrator",
  superAdmin: "CEO",
};

export const formatDate = (date) => formatDay(date);

// Case- and whitespace-insensitive "contains" match across several values.
const normalize = (value) => String(value ?? "").toLowerCase().replace(/\s+/g, "");

export const matchesQuery = (query, values) => {
  const q = normalize(query);
  if (!q) return true;
  return values.flat().some((value) => normalize(value).includes(q));
};

export const employeeSearchValues = (e) => [
  `${e.firstName} ${e.lastName}`,
  e.email,
  e.personalEmail,
  e.phone,
  e.role,
  e.position,
  e.departmentId?.name,
  (e.skills || []).map((skill) => (typeof skill === "string" ? skill : skill?.name)),
];

export const departmentSearchValues = (d) => [
  d.name,
  d.managerId ? `${d.managerId.firstName} ${d.managerId.lastName}` : "",
  (d.employees || []).map((emp) => `${emp.firstName} ${emp.lastName}`),
];
