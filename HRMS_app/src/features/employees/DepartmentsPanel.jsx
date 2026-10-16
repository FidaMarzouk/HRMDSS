import { useMemo, useState } from "react";
import { Plus, Search } from "lucide-react";
import api, { errorMessage } from "../../lib/api";
import { confirmAction, showError, showSuccess } from "../../lib/alerts";
import Pagination, { usePagination } from "../../components/Pagination";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/field";
import DepartmentTable from "./DepartmentTable";
import DepartmentFormModal from "./DepartmentFormModal";
import { DepartmentDetailsModal } from "./DepartmentDetailsModal";
import { departmentSearchValues, matchesQuery } from "./employeeUtils";
import { refreshPeople, useDepartments } from "../people/peopleApi";

// Departments tab of the People page: HR edits, the CEO views.
export function DepartmentsPanel({ canEdit }) {
  const { data, isLoading } = useDepartments();
  const departments = useMemo(() => (Array.isArray(data) ? data : []), [data]);
  const [query, setQuery] = useState("");
  const [form, setForm] = useState({ open: false, department: null });
  const [viewing, setViewing] = useState(null);
  const filtered = useMemo(() => departments.filter((d) => matchesQuery(query, departmentSearchValues(d))), [departments, query]);
  const paging = usePagination(filtered, 10, query);

  const remove = async (department) => {
    const ok = await confirmAction(
      `Delete ${department.name}?`,
      `Its ${department.employees?.length || 0} members will no longer have a department or manager. The deletion is recorded in the audit log.`,
      "Delete department"
    );
    if (!ok) return;
    try {
      await api.delete(`/api/departments/${department._id}`);
      showSuccess("Department deleted");
      refreshPeople();
    } catch (err) {
      showError("Could not delete the department", errorMessage(err));
    }
  };

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3" aria-hidden="true" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search departments…" aria-label="Search departments" className="pl-9" />
        </div>
        {canEdit && (
          <Button onClick={() => setForm({ open: true, department: null })}>
            <Plus /> Add department
          </Button>
        )}
      </div>
      <DepartmentTable
        departments={paging.pageItems}
        loading={isLoading}
        renderActions={(d) =>
          canEdit ? (
            <>
              <Button size="sm" variant="secondary" onClick={() => setForm({ open: true, department: d })}>Edit</Button>
              <Button size="sm" variant="ghost" className="text-red hover:text-red" onClick={() => remove(d)}>Delete…</Button>
            </>
          ) : (
            <Button size="sm" variant="secondary" onClick={() => setViewing(d)}>View</Button>
          )
        }
      />
      <Pagination {...paging.pagination} noun="departments" />
      {canEdit && (
        <DepartmentFormModal
          open={form.open}
          department={form.department}
          onClose={() => setForm({ open: false, department: null })}
          onSaved={(message) => {
            setForm({ open: false, department: null });
            showSuccess(message || "Department saved");
            refreshPeople();
          }}
        />
      )}
      <DepartmentDetailsModal department={viewing} onClose={() => setViewing(null)} />
    </div>
  );
}
