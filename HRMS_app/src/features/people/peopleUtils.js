// Small helpers for the People views.

export const skillNames = (skills) => (skills || []).map((s) => (typeof s === "string" ? s : s?.name)).filter(Boolean);

// Highest-rated skills first, then in the order recorded.
export const topSkills = (skills, n = 2) =>
  [...(skills || [])]
    .map((s, i) => (typeof s === "string" ? { name: s, level: 0, i } : { ...s, level: s.level || 0, i }))
    .sort((a, b) => b.level - a.level || a.i - b.i)
    .slice(0, n)
    .map((s) => s.name);

// { years, months, label: "9 y 7 m", since: "2017" }
export const tenure = (hireDate, now = new Date()) => {
  if (!hireDate) return null;
  const start = new Date(hireDate);
  let months = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth());
  if (now.getDate() < start.getDate()) months -= 1;
  months = Math.max(0, months);
  const years = Math.floor(months / 12);
  const rest = months % 12;
  return {
    years: months / 12,
    label: years ? `${years} y ${rest} m` : `${rest} m`,
    since: String(start.getFullYear()),
  };
};

export const fullName = (p) => (p ? `${p.firstName || ""} ${p.lastName || ""}`.trim() : "");

export const ACCESS_LABEL = { employee: "Employee", manager: "Manager", admin: "HR", superAdmin: "CEO" };

// Presence ("in", "late", ...) to the avatar dot vocabulary.
export const presenceDot = (status) =>
  ({ in: "in", late: "late", leave: "leave", mission: "leave", left: "out", out: "out", absent: "out" })[status];
