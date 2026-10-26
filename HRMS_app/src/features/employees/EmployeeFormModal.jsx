import { useEffect, useState } from "react";
import { FaRobot } from "react-icons/fa";
import api, { uploadUrl } from "../../lib/api";
import { toDateInputValue } from "../../lib/dates";

const EMPTY = {
  firstName: "", lastName: "", email: "", personalEmail: "", phone: "", skills: "",
  hireDate: "", role: "", position: "", salary: "", departmentId: "", password: "",
};

// Only these fields are ever sent; never the whole user document.
const EDITABLE_FIELDS = Object.keys(EMPTY);
const REQUIRED_ON_CREATE = ["firstName", "lastName", "email", "personalEmail", "phone", "position", "role", "salary", "hireDate"];

const toFormValues = (employee) => ({
  ...EMPTY,
  ...Object.fromEntries(EDITABLE_FIELDS.map((key) => [key, employee?.[key] ?? ""])),
  skills: Array.isArray(employee?.skills) ? employee.skills.join(", ") : employee?.skills || "",
  hireDate: toDateInputValue(employee?.hireDate),
  departmentId: employee?.departmentId?._id || employee?.departmentId || "",
  password: "",
});

const validationMessage = (error) => {
  const errors = error.response?.data?.errors;
  if (Array.isArray(errors)) return `Please correct the following:\n• ${errors.map((e) => e.msg).join("\n• ")}`;
  return error.response?.data?.message || "An error occurred while saving. Please try again.";
};

const inputClass = "p-2 border border-edge rounded w-full bg-panel text-ink focus:border-teal focus:outline-none focus:ring-2 focus:ring-teal/25 placeholder:text-ink-3";

// Create (employee = null) or edit an employee.
const EmployeeFormModal = ({ open, employee, departments, onClose, onSaved }) => {
  const isEditing = Boolean(employee);
  const [values, setValues] = useState(EMPTY);
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setValues(toFormValues(employee));
    setFile(null);
    setPreview(employee?.profilePicture ? uploadUrl(employee.profilePicture) : null);
    setError("");
  }, [open, employee]);

  // Release object URLs created for previews.
  useEffect(() => () => {
    if (preview?.startsWith("blob:")) URL.revokeObjectURL(preview);
  }, [preview]);

  if (!open) return null;

  const setField = (e) => setValues((prev) => ({ ...prev, [e.target.name]: e.target.value }));

  const handleFile = (e) => {
    const selected = e.target.files[0];
    if (selected) {
      setFile(selected);
      setPreview(URL.createObjectURL(selected));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!isEditing) {
      const missing = REQUIRED_ON_CREATE.filter((field) => !values[field]);
      if (missing.length > 0) {
        setError(`Please fill in all required fields: ${missing.join(", ")}`);
        return;
      }
    }

    const formData = new FormData();
    EDITABLE_FIELDS.forEach((field) => {
      if (isEditing && field === "role") return; // role is fixed after creation
      if (values[field] !== "" && values[field] != null) formData.append(field, values[field]);
    });
    if (file) formData.append("profilePicture", file);

    setSaving(true);
    try {
      if (isEditing) {
        await api.put(`/api/users/${employee._id}`, formData);
      } else {
        await api.post("/api/users", formData);
      }
      onSaved(isEditing ? "Employee details updated successfully!" : "New employee added. A set-password link was emailed to them.");
    } catch (err) {
      setError(validationMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const field = (name, label, { wide, ...inputProps } = {}) => (
    <div className={wide ? "col-span-1 md:col-span-2" : ""}>
      <label htmlFor={`emp-${name}`} className="block text-sm font-semibold mb-1 text-ink">{label}</label>
      <input id={`emp-${name}`} name={name} value={values[name]} onChange={setField} className={inputClass} {...inputProps} />
    </div>
  );

  return (
    <div className="fixed inset-0 bg-scrim flex justify-center items-center backdrop-blur-sm z-50 p-4" role="dialog" aria-modal="true">
      <form className="bg-raise p-6 rounded-lg w-full max-w-[600px] max-h-[90vh] overflow-y-auto shadow-lg border border-line-2" onSubmit={handleSubmit}>
        {error && (
          <div className="p-4 bg-red/10 text-red rounded-md mb-4 border-l-4 border-red">
            <div className="flex items-center mb-2">
              <FaRobot className="mr-2 text-xl" />
              <span className="font-semibold">Could not save</span>
            </div>
            <div className="whitespace-pre-line pl-6">{error}</div>
          </div>
        )}
        <h3 className="text-xl font-semibold text-center mb-4 text-teal">{isEditing ? "Edit" : "Add"} Employee</h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="col-span-1 md:col-span-2">
            <label htmlFor="emp-picture" className="block text-sm font-semibold mb-1 text-ink">Profile picture (JPG or PNG, max 2 MB)</label>
            <input id="emp-picture" type="file" accept="image/png, image/jpeg" onChange={handleFile} className={inputClass} />
            {preview && <img src={preview} alt="Profile preview" className="mt-2 h-24 w-24 object-cover rounded-full border-2 border-teal mx-auto" />}
          </div>

          {field("firstName", "First name")}
          {field("lastName", "Last name")}
          {field("email", "Work email (login)", { type: "email", required: true })}
          {field("personalEmail", "Personal email", { type: "email", required: !isEditing })}
          {field("phone", "Phone")}
          {field("position", "Position")}
          {field("skills", "Skills (comma-separated)", { wide: true, placeholder: "ROS, Embedded C, SolidWorks…" })}
          {field("hireDate", "Hire date", { type: "date" })}
          {field("salary", "Salary (DT)", { type: "number", min: "0", step: "0.01" })}

          <div>
            <label htmlFor="emp-role" className="block text-sm font-semibold mb-1 text-ink">Role</label>
            <select id="emp-role" name="role" value={values.role} onChange={setField} className={inputClass} disabled={isEditing}>
              <option value="">Select role</option>
              <option value="employee">Employee</option>
              <option value="manager">Manager</option>
            </select>
          </div>

          <div>
            <label htmlFor="emp-department" className="block text-sm font-semibold mb-1 text-ink">Department</label>
            <select id="emp-department" name="departmentId" value={values.departmentId} onChange={setField} className={inputClass}>
              <option value="">Select department</option>
              {departments.map((dept) => (
                <option key={dept._id} value={dept._id}>{dept.name}</option>
              ))}
            </select>
          </div>

          <div className="col-span-1 md:col-span-2">
            <label htmlFor="emp-password" className="block text-sm font-semibold mb-1 text-ink">
              {isEditing ? "New password (optional)" : "Initial password (optional)"}
            </label>
            <input id="emp-password" type="password" name="password" value={values.password} onChange={setField} className={inputClass} autoComplete="new-password" />
            <p className="text-xs text-ink-2 mt-1">
              {isEditing
                ? "Leave empty to keep the current password. The employee is notified (without the password) if it changes."
                : "Leave empty: the employee receives an email link to choose their own password."}
            </p>
          </div>

          <div className="col-span-1 md:col-span-2 flex flex-col sm:flex-row gap-2 mt-2">
            <button type="submit" disabled={saving} className="w-full sm:w-1/2 px-4 py-2 bg-teal text-on-accent rounded-lg hover:bg-teal-hi disabled:opacity-50 transition-colors shadow-md">
              {saving ? "Saving…" : isEditing ? "Save changes" : "Add employee"}
            </button>
            <button type="button" onClick={onClose} className="w-full sm:w-1/2 px-4 py-2 bg-sunk text-ink rounded-lg hover:bg-line transition-colors shadow-md">
              Cancel
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};

export default EmployeeFormModal;
