import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { FaEye, FaSitemap, FaUsers, FaUserTie } from "react-icons/fa";
import { RefreshCw } from "lucide-react";
import api, { errorMessage } from "../../lib/api";
import { useAuth } from "../../context/AuthContext";
import Pagination, { usePagination } from "../../components/Pagination";
import EmployeeTable from "./EmployeeTable";
import DepartmentTable from "./DepartmentTable";
import { DepartmentDetailsModal, EmployeeDetailsModal } from "./DetailsModals";
import { departmentSearchValues, employeeSearchValues, matchesQuery } from "./employeeUtils";

export const SearchBox = ({ value, onChange, placeholder }) => (
  <div className="relative mb-4">
    <input
      type="search"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      aria-label={placeholder}
      className="w-full p-3 bg-panel border border-edge rounded-lg text-ink focus:outline-none focus:ring-2 focus:ring-teal focus:border-transparent"
    />
  </div>
);

const ViewButton = ({ onClick }) => (
  <button type="button" onClick={onClick} className="px-3 py-1 border border-edge text-ink rounded text-xs flex items-center hover:border-teal hover:bg-sunk transition-colors">
    <FaEye className="mr-1" /> View
  </button>
);

// Read-only directory: a manager sees their team; the CEO sees everyone plus departments and salaries.
const EmployeeDirectoryPage = () => {
  const { user } = useAuth();
  const isCeo = user?.role === "superAdmin";
  const [tab, setTab] = useState("employees");
  const [employees, setEmployees] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  // ?q= (from the command palette) pre-fills the search.
  const [searchParams] = useSearchParams();
  const [query, setQuery] = useState(() => searchParams.get("q") || "");
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [selectedDepartment, setSelectedDepartment] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [usersRes, deptRes] = await Promise.all([
        api.get("/api/users"),
        isCeo ? api.get("/api/departments") : Promise.resolve({ data: [] }),
      ]);
      setEmployees(usersRes.data.users || usersRes.data.employees || []);
      setDepartments(Array.isArray(deptRes.data) ? deptRes.data : []);
      setError(null);
    } catch (err) {
      setError(errorMessage(err, "Failed to load employees."));
    } finally {
      setLoading(false);
    }
  }, [isCeo]);

  useEffect(() => {
    load();
  }, [load]);

  const filteredEmployees = useMemo(
    () => employees.filter((e) => matchesQuery(query, employeeSearchValues(e))),
    [employees, query]
  );
  const filteredDepartments = useMemo(
    () => departments.filter((d) => matchesQuery(query, departmentSearchValues(d))),
    [departments, query]
  );

  const employeePaging = usePagination(filteredEmployees, 8, query);
  const departmentPaging = usePagination(filteredDepartments, 8, query);

  const columns = isCeo
    ? ["name", "email", "role", "position", "department", "hireDate", "salary"]
    : ["name", "email", "phone", "position", "hireDate", "leave"];

  return (
    <div className="p-3 bg-panel flex flex-col rounded-xl border border-line shadow-lg">
      <div className="flex items-center justify-between flex-wrap gap-2 mb-4">
        <div className="flex items-center">
          <FaUserTie className="text-teal text-2xl mr-2" />
          <h1 className="text-teal text-2xl font-semibold">{isCeo ? "Company Directory" : "My Team"}</h1>
        </div>
        <button type="button" onClick={load} className="flex items-center gap-2 px-4 py-2 bg-panel hover:bg-sunk rounded-lg border border-line text-ink transition-colors">
          <RefreshCw className="h-4 w-4" /> Refresh
        </button>
      </div>

      {isCeo && (
        <div className="flex mb-4 border-b border-line" role="tablist">
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
      )}

      {error && <div className="mb-3 p-3 rounded bg-red/10 border border-red/30 text-red text-sm">{error}</div>}

      <SearchBox value={query} onChange={setQuery} placeholder={tab === "employees" ? "Search employees…" : "Search departments…"} />

      {tab === "employees" ? (
        <>
          <EmployeeTable
            employees={employeePaging.pageItems}
            columns={columns}
            loading={loading}
            emptyMessage={isCeo ? "No employees found." : "No team members found."}
            renderActions={(employee) => <ViewButton onClick={() => setSelectedEmployee(employee)} />}
          />
          <Pagination {...employeePaging.pagination} noun="employees" />
        </>
      ) : (
        <>
          <DepartmentTable
            departments={departmentPaging.pageItems}
            loading={loading}
            renderActions={(dept) => <ViewButton onClick={() => setSelectedDepartment(dept)} />}
          />
          <Pagination {...departmentPaging.pagination} noun="departments" />
        </>
      )}

      <EmployeeDetailsModal employee={selectedEmployee} showSalary={isCeo} onClose={() => setSelectedEmployee(null)} />
      <DepartmentDetailsModal department={selectedDepartment} onClose={() => setSelectedDepartment(null)} />
    </div>
  );
};

export default EmployeeDirectoryPage;
