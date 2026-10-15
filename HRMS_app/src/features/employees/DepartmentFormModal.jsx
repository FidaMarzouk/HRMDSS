import { useEffect, useState } from "react";
import api, { errorMessage } from "../../lib/api";

const inputClass = "w-full p-2 text-sm border border-[#444] rounded bg-[#333] text-gray-300";

// Create (department = null) or edit a department, its manager and members.
const DepartmentFormModal = ({ open, department, onClose, onSaved }) => {
  const isEditing = Boolean(department);
  const [name, setName] = useState("");
  const [managerId, setManagerId] = useState("");
  const [employeeIds, setEmployeeIds] = useState([]);
  const [managers, setManagers] = useState([]);
  const [assignable, setAssignable] = useState([]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(department?.name || "");
    setManagerId(department?.managerId?._id || "");
    setEmployeeIds((department?.employees || []).map((emp) => emp._id || emp));
    setError("");
    Promise.all([
      api.get("/api/departments/available-managers"),
      api.get("/api/departments/assignable-employees"),
    ])
      .then(([managersRes, employeesRes]) => {
        setManagers(managersRes.data.availableManagers || []);
        setAssignable(employeesRes.data.employees || []);
      })
      .catch((err) => setError(errorMessage(err, "Could not load managers and employees.")));
  }, [open, department]);

  if (!open) return null;

  const toggleEmployee = (id, checked) =>
    setEmployeeIds((prev) => (checked ? [...prev, id] : prev.filter((existing) => existing !== id)));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Please enter a department name.");
      return;
    }
    const payload = { name: name.trim(), managerId: managerId || null, employeeIds };
    setSaving(true);
    try {
      if (isEditing) {
        await api.put(`/api/departments/${department._id}`, payload);
      } else {
        await api.post("/api/departments", payload);
      }
      onSaved(isEditing ? "Department updated successfully!" : "Department created successfully!");
    } catch (err) {
      setError(errorMessage(err, "An error occurred while saving the department."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex justify-center items-center backdrop-blur-sm z-50 p-4" role="dialog" aria-modal="true">
      <div className="bg-[#2a2a2a] p-4 sm:p-6 rounded-lg shadow-lg border border-[#444] w-full max-w-[600px] max-h-[90vh] overflow-y-auto">
        <h2 className="text-lg sm:text-xl font-semibold text-center mb-4 text-[#33adb4]">{isEditing ? "Edit Department" : "Add Department"}</h2>

        {error && <div className="mb-4 p-3 bg-red-900/50 border border-red-500 rounded text-red-200 text-sm">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label htmlFor="dept-name" className="block text-sm font-semibold mb-1 text-gray-300">Department name</label>
            <input id="dept-name" value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
          </div>

          <div className="mb-4">
            <label htmlFor="dept-manager" className="block text-sm font-semibold mb-1 text-gray-300">Manager</label>
            <select id="dept-manager" value={managerId} onChange={(e) => setManagerId(e.target.value)} className={inputClass}>
              <option value="">No manager</option>
              {managers.map((manager) => (
                <option key={manager._id} value={manager._id}>
                  {manager.firstName} {manager.lastName}
                  {manager.currentDepartment && ` (currently: ${manager.currentDepartment})`}
                </option>
              ))}
            </select>
            <p className="text-xs text-amber-400 mt-1">A manager who already leads another department will be moved here.</p>
          </div>

          <fieldset className="mb-4">
            <legend className="block text-sm font-semibold mb-2 text-gray-300">Members</legend>
            <div className="max-h-60 overflow-y-auto border border-[#444] rounded p-2 bg-[#333]">
              {assignable.length === 0 && <p className="text-gray-500 text-center py-2 text-sm">No employees available</p>}
              {assignable.map((employee) => (
                <div key={employee._id} className="flex items-center mb-1 hover:bg-[#3a3a3a] p-1 rounded">
                  <input
                    type="checkbox"
                    id={`dept-emp-${employee._id}`}
                    checked={employeeIds.includes(employee._id)}
                    onChange={(e) => toggleEmployee(employee._id, e.target.checked)}
                    className="mr-2 accent-[#33adb4]"
                  />
                  <label htmlFor={`dept-emp-${employee._id}`} className="text-sm flex-1 text-gray-300">
                    {employee.firstName} {employee.lastName} — {employee.position}
                    {employee.departmentId?.name && <span className="text-gray-500 ml-2 text-xs">(currently: {employee.departmentId.name})</span>}
                  </label>
                </div>
              ))}
            </div>
            <p className="text-xs text-amber-400 mt-1">Selected employees are moved out of their current department.</p>
          </fieldset>

          <div className="flex flex-col sm:flex-row gap-2 mt-4">
            <button type="submit" disabled={saving} className="w-full sm:w-1/2 px-4 py-2 bg-[#33adb4] text-white rounded-lg hover:bg-[#2a8c92] disabled:opacity-50 transition-colors shadow-md">
              {saving ? "Saving…" : isEditing ? "Save changes" : "Add department"}
            </button>
            <button type="button" onClick={onClose} className="w-full sm:w-1/2 px-4 py-2 bg-[#444] text-white rounded-lg hover:bg-[#555] transition-colors shadow-md">
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default DepartmentFormModal;
