import { formatDay } from "../../lib/dates";

export const ROLE_LABELS = {
  employee: "Employee",
  manager: "Manager",
  admin: "HR Administrator",
  superAdmin: "CEO",
};

const ROLE_COLORS = {
  admin: "#e6b23b",
  manager: "#33adb4",
  employee: "#31638a",
};

export const roleColor = (role) => ROLE_COLORS[role] || "#878285";

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
  e.skills || [],
];

export const departmentSearchValues = (d) => [
  d.name,
  d.managerId ? `${d.managerId.firstName} ${d.managerId.lastName}` : "",
  (d.employees || []).map((emp) => `${emp.firstName} ${emp.lastName}`),
];
