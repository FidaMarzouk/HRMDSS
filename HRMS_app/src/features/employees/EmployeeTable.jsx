import { uploadUrl } from "../../lib/api";
import { ROLE_LABELS, formatDate, roleColor } from "./employeeUtils";

export const RoleBadge = ({ role }) => {
  const color = roleColor(role);
  return (
    <span
      className="px-2 py-1 rounded-full text-xs font-medium inline-block whitespace-nowrap"
      style={{ backgroundColor: `${color}33`, color, border: `1px solid ${color}` }}
    >
      {ROLE_LABELS[role] || role}
    </span>
  );
};

const Avatar = ({ employee, size = "h-12 w-12" }) => (
  <div className={`${size} rounded-full border-2 border-[#33adb4] overflow-hidden bg-[#1a1a1a] flex-shrink-0`}>
    <img src={uploadUrl(employee.profilePicture)} alt="" className={`${size} object-cover`} />
  </div>
);

// Column definitions; pages pick which ones to show.
const COLUMNS = {
  name: { label: "Name", render: (e) => <span className="text-white font-medium">{e.firstName} {e.lastName}</span> },
  email: { label: "Email", render: (e) => e.email },
  phone: { label: "Phone", render: (e) => e.phone },
  role: { label: "Role", render: (e) => <RoleBadge role={e.role} /> },
  position: { label: "Position", render: (e) => e.position },
  department: { label: "Department", render: (e) => e.departmentId?.name || "—" },
  hireDate: { label: "Hire date", render: (e) => formatDate(e.hireDate) },
  leave: { label: "Leave balance", render: (e) => (e.remainingLeaveDays ?? "—") },
  salary: { label: "Salary", render: (e) => (e.salary != null ? `${Number(e.salary).toLocaleString()} DT` : "—") },
};

/**
 * Responsive employee list (table on desktop, cards on mobile).
 * `columns`: keys of COLUMNS to display. `renderActions(employee)`: action buttons.
 */
const EmployeeTable = ({ employees, columns, renderActions, loading, emptyMessage = "No employees found." }) => {
  const cols = columns.map((key) => ({ key, ...COLUMNS[key] }));
  const empty = loading ? "Loading…" : emptyMessage;

  return (
    <>
      <div className="hidden md:block w-full overflow-x-auto mt-1 rounded-lg bg-[#222] shadow-inner border border-[#333]">
        <table className="table-auto w-full text-left border-separate border-spacing-y-1">
          <thead className="bg-[#2c2c2c] sticky top-0">
            <tr>
              <th className="py-3 px-3"><span className="sr-only">Photo</span></th>
              {cols.map((c) => (
                <th key={c.key} className="py-3 px-3 text-[#33adb4] text-sm font-bold">{c.label}</th>
              ))}
              {renderActions && <th className="py-3 px-3 text-[#33adb4] text-sm font-bold text-center">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {employees.length === 0 && (
              <tr className="bg-[#2a2a2a]">
                <td colSpan={cols.length + 2} className="py-4 px-3 text-sm text-center text-gray-400">{empty}</td>
              </tr>
            )}
            {employees.map((employee) => (
              <tr key={employee._id} className="bg-[#2a2a2a] hover:bg-[#333] transition-colors">
                <td className="py-3 px-3"><Avatar employee={employee} /></td>
                {cols.map((c) => (
                  <td key={c.key} className="py-3 px-3 text-sm text-gray-300">{c.render(employee)}</td>
                ))}
                {renderActions && <td className="py-3 px-3 text-sm"><div className="flex justify-center gap-2">{renderActions(employee)}</div></td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="md:hidden space-y-4">
        {employees.length === 0 && <div className="py-8 text-center text-gray-400">{empty}</div>}
        {employees.map((employee) => (
          <div key={employee._id} className="bg-[#2a2a2a] rounded-lg p-4 shadow-md border border-[#333]">
            <div className="flex items-center space-x-4 mb-4">
              <Avatar employee={employee} size="h-16 w-16" />
              <div>
                <div className="text-white font-semibold">{employee.firstName} {employee.lastName}</div>
                <div className="text-xs text-gray-300">{employee.email}</div>
              </div>
            </div>
            <dl className="grid grid-cols-2 gap-2 mb-4 text-sm">
              {cols.filter((c) => c.key !== "name" && c.key !== "email").map((c) => (
                <div key={c.key} className="contents">
                  <dt className="text-xs text-gray-400">{c.label}</dt>
                  <dd className="text-white">{c.render(employee)}</dd>
                </div>
              ))}
            </dl>
            {renderActions && <div className="flex gap-2">{renderActions(employee)}</div>}
          </div>
        ))}
      </div>
    </>
  );
};

export default EmployeeTable;
