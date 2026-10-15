import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle } from "../../components/ui/alert-dialog";
import { uploadUrl } from "../../lib/api";
import { ROLE_LABELS, formatDate } from "./employeeUtils";

const Section = ({ title, children }) => (
  <section>
    <h3 className="text-lg font-semibold mb-2 text-teal">{title}</h3>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 border border-line rounded-lg bg-panel">{children}</div>
  </section>
);

const Item = ({ label, children }) => (
  <div>
    <p className="text-sm font-semibold text-ink-2">{label}</p>
    <p className="border border-line-2 rounded-md p-2 bg-raise text-ink min-h-[2.5rem] break-words">{children ?? "—"}</p>
  </div>
);

const ModalShell = ({ title, open, onClose, children }) => (
  <AlertDialog open={open} onOpenChange={(value) => !value && onClose()}>
    <AlertDialogContent className="!max-w-[640px] max-h-[85vh] overflow-y-auto p-0">
      <AlertDialogHeader className="flex flex-row items-center justify-between px-6 py-4 border-b border-line">
        <AlertDialogTitle className="text-2xl font-bold text-ink">{title}</AlertDialogTitle>
        <button type="button" aria-label="Close" onClick={onClose} className="text-ink hover:text-ink text-2xl font-bold">×</button>
      </AlertDialogHeader>
      <div className="grid grid-cols-1 gap-4 p-6">{children}</div>
    </AlertDialogContent>
  </AlertDialog>
);

// Read-only employee profile. Salary is shown only when `showSalary` is set (CEO view).
export const EmployeeDetailsModal = ({ employee, onClose, showSalary = false }) => (
  <ModalShell title="Employee Profile" open={Boolean(employee)} onClose={onClose}>
    {employee && (
      <>
        <div className="flex justify-center">
          <img src={uploadUrl(employee.profilePicture)} alt="" className="w-32 h-32 rounded-full border-4 border-line shadow-md object-cover" />
        </div>
        <Section title="Basic information">
          <Item label="Name">{employee.firstName} {employee.lastName}</Item>
          <Item label="Role">{ROLE_LABELS[employee.role] || employee.role}</Item>
          <Item label="Position">{employee.position}</Item>
          <Item label="Department">{employee.departmentId?.name}</Item>
          <Item label="Hire date">{formatDate(employee.hireDate)}</Item>
          {employee.managerId && <Item label="Manager">{employee.managerId.firstName} {employee.managerId.lastName}</Item>}
          {showSalary && <Item label="Salary">{employee.salary != null ? `${Number(employee.salary).toLocaleString()} DT` : null}</Item>}
        </Section>
        <Section title="Contact">
          <Item label="Work email">{employee.email}</Item>
          <Item label="Phone">{employee.phone}</Item>
        </Section>
        <Section title="Leave">
          <Item label="Days accrued">{employee.leaveRequestAllowed}</Item>
          <Item label="Days remaining">{employee.remainingLeaveDays}</Item>
        </Section>
        <section>
          <h3 className="text-lg font-semibold mb-2 text-teal">Skills</h3>
          <div className="flex flex-wrap gap-2 p-4 border border-line rounded-lg bg-panel">
            {employee.skills?.length ? (
              employee.skills.map((skill) => (
                <span key={skill} className="px-3 py-1 bg-raise rounded-full text-sm border border-line-2 text-ink">{skill}</span>
              ))
            ) : (
              <span className="text-ink-2">No skills listed</span>
            )}
          </div>
        </section>
      </>
    )}
  </ModalShell>
);

export const DepartmentDetailsModal = ({ department, onClose }) => (
  <ModalShell title="Department Details" open={Boolean(department)} onClose={onClose}>
    {department && (
      <>
        <Section title="Department">
          <Item label="Name">{department.name}</Item>
          <Item label="Employees">{department.employees?.length || 0}</Item>
          <Item label="Manager">
            {department.managerId ? `${department.managerId.firstName} ${department.managerId.lastName}` : "No manager assigned"}
          </Item>
          <Item label="Manager email">{department.managerId?.email}</Item>
        </Section>
        <section>
          <h3 className="text-lg font-semibold mb-2 text-teal">Members</h3>
          {department.employees?.length ? (
            <div className="overflow-x-auto rounded-lg bg-panel border border-line">
              <table className="table-auto w-full text-left">
                <thead className="bg-raise">
                  <tr>
                    <th className="py-2 px-3 text-xs text-teal font-semibold">Name</th>
                    <th className="py-2 px-3 text-xs text-teal font-semibold">Email</th>
                    <th className="py-2 px-3 text-xs text-teal font-semibold">Position</th>
                  </tr>
                </thead>
                <tbody>
                  {department.employees.map((emp) => (
                    <tr key={emp._id} className="border-t border-line">
                      <td className="py-2 px-3 text-sm text-ink">{emp.firstName} {emp.lastName}</td>
                      <td className="py-2 px-3 text-sm text-ink">{emp.email}</td>
                      <td className="py-2 px-3 text-sm text-ink">{emp.position}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="p-4 border border-line rounded-lg bg-panel text-ink-2">No employees in this department</p>
          )}
        </section>
      </>
    )}
  </ModalShell>
);
