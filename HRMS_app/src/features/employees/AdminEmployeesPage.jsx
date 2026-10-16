import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { FaRobot, FaSitemap, FaUserPlus, FaUsers } from "react-icons/fa";
import { RefreshCw } from "lucide-react";
import api, { errorMessage } from "../../lib/api";
import { confirmAction, showError } from "../../lib/alerts";
import Pagination, { usePagination } from "../../components/Pagination";
import EmployeeTable from "./EmployeeTable";
import DepartmentTable from "./DepartmentTable";
import EmployeeFormModal from "./EmployeeFormModal";
import DepartmentFormModal from "./DepartmentFormModal";
import { SearchBox } from "./EmployeeDirectoryPage";
import { departmentSearchValues, employeeSearchValues, matchesQuery } from "./employeeUtils";

const actionButton = "px-2 py-1 text-ink rounded text-xs transition-colors";

// HR administration of employees and departments.
const AdminEmployeesPage = () => {
  const [tab, setTab] = useState("employees");
  const [employees, setEmployees] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  // ?q= (from the command palette) pre-fills the search.
  const [searchParams] = useSearchParams();
  const [query, setQuery] = useState(() => searchParams.get("q") || "");
  const [successMessage, setSuccessMessage] = useState("");
  const [employeeForm, setEmployeeForm] = useState({ open: false, employee: null });
  const [departmentForm, setDepartmentForm] = useState({ open: false, department: null });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [usersRes, deptRes] = await Promise.all([api.get("/api/users"), api.get("/api/departments")]);
      setEmployees(usersRes.data.users || []);
      setDepartments(Array.isArray(deptRes.data) ? deptRes.data : []);
    } catch (err) {
      showError("Could not load data", errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!successMessage) return undefined;
    const timer = setTimeout(() => setSuccessMessage(""), 4000);
    return () => clearTimeout(timer);
  }, [successMessage]);

  const filteredEmployees = useMemo(() => employees.filter((e) => matchesQuery(query, employeeSearchValues(e))), [employees, query]);
  const filteredDepartments = useMemo(() => departments.filter((d) => matchesQuery(query, departmentSearchValues(d))), [departments, query]);
  const employeePaging = usePagination(filteredEmployees, 8, query);
  const departmentPaging = usePagination(filteredDepartments, 8, query);

  const handleSaved = (message) => {
    setEmployeeForm({ open: false, employee: null });
    setDepartmentForm({ open: false, department: null });
    setSuccessMessage(message);
    load();
  };

  const deleteEmployee = async (employee) => {
    const confirmed = await confirmAction(
      "Delete employee?",
      `${employee.firstName} ${employee.lastName} will be removed permanently. This cannot be undone.`,
      "Yes, delete"
    );
    if (!confirmed) return;
    try {
      await api.delete(`/api/users/${employee._id}`);
      setSuccessMessage("Employee deleted successfully!");
      load();
    } catch (err) {
      showError("Could not delete employee", errorMessage(err));
    }
  };

  const deleteDepartment = async (department) => {
    const confirmed = await confirmAction(
      "Delete department?",
      `"${department.name}" will be deleted and its members will no longer have a department or manager.`,
      "Yes, delete"
    );
    if (!confirmed) return;
    try {
      await api.delete(`/api/departments/${department._id}`);
      setSuccessMessage("Department deleted successfully!");
      load();
    } catch (err) {
      showError("Could not delete department", errorMessage(err));
    }
  };

  const isEmployees = tab === "employees";

  return (
    <div className="p-3 bg-panel flex flex-col rounded-xl border border-line shadow-lg">
      {successMessage && (
        <div className="p-4 bg-teal text-on-accent rounded-md mb-4 border-l-4 border-teal flex items-center" role="status">
          <FaRobot className="mr-2 text-xl" />
          {successMessage}
        </div>
      )}

      <div className="flex mb-6 border-b border-line text-lg font-medium" role="tablist">
        {[
          { key: "employees", label: "Employees", icon: FaUsers },
          { key: "departments", label: "Departments", icon: FaSitemap },
        ].map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            onClick={() => {
              setTab(key);
              setQuery("");
            }}
            className={`flex items-center px-4 py-3 -mb-px border-b-2 ${tab === key ? "text-teal border-teal" : "text-ink-2 border-transparent hover:text-ink"}`}
          >
            <Icon className="mr-2" /> {label}
          </button>
        ))}
      </div>

      <div className="flex items-center justify-between flex-wrap gap-2 mb-4">
        <h1 className="flex items-center text-teal text-2xl font-semibold">
          {isEmployees ? <FaRobot className="mr-2" /> : <FaSitemap className="mr-2" />}
          {isEmployees ? "Employee Management" : "Department Management"}
        </h1>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => (isEmployees ? setEmployeeForm({ open: true, employee: null }) : setDepartmentForm({ open: true, department: null }))}
            className="px-4 py-2 bg-teal text-on-accent rounded flex items-center transition-all hover:bg-teal-hi shadow-lg"
          >
            {isEmployees ? <FaUserPlus className="mr-2" /> : <FaSitemap className="mr-2" />}
            {isEmployees ? "Add Employee" : "Add Department"}
          </button>
          <button type="button" onClick={load} className="flex items-center gap-2 px-4 py-2 bg-panel hover:bg-sunk rounded-lg border border-line text-ink transition-colors">
            <RefreshCw className="h-4 w-4" /> Refresh
          </button>
        </div>
      </div>

      <SearchBox value={query} onChange={setQuery} placeholder={isEmployees ? "Search employees…" : "Search departments…"} />

      {isEmployees ? (
        <>
          <EmployeeTable
            employees={employeePaging.pageItems}
            columns={["name", "email", "role", "position", "department", "hireDate"]}
            loading={loading}
            renderActions={(employee) => (
              <>
                <button type="button" className={`${actionButton} bg-teal hover:bg-teal-hi`} onClick={() => setEmployeeForm({ open: true, employee })}>Edit</button>
                <button type="button" className={`${actionButton} bg-red hover:bg-red/90`} onClick={() => deleteEmployee(employee)}>Delete</button>
              </>
            )}
          />
          <Pagination {...employeePaging.pagination} noun="employees" />
        </>
      ) : (
        <>
          <DepartmentTable
            departments={departmentPaging.pageItems}
            loading={loading}
            renderActions={(department) => (
              <>
                <button type="button" className={`${actionButton} bg-teal hover:bg-teal-hi`} onClick={() => setDepartmentForm({ open: true, department })}>Edit</button>
                <button type="button" className={`${actionButton} bg-red hover:bg-red/90`} onClick={() => deleteDepartment(department)}>Delete</button>
              </>
            )}
          />
          <Pagination {...departmentPaging.pagination} noun="departments" />
        </>
      )}

      <EmployeeFormModal
        open={employeeForm.open}
        employee={employeeForm.employee}
        departments={departments}
        onClose={() => setEmployeeForm({ open: false, employee: null })}
        onSaved={handleSaved}
      />
      <DepartmentFormModal
        open={departmentForm.open}
        department={departmentForm.department}
        onClose={() => setDepartmentForm({ open: false, department: null })}
        onSaved={handleSaved}
      />
    </div>
  );
};

export default AdminEmployeesPage;
