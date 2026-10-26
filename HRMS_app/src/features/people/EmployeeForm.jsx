import { useEffect, useState } from "react";
import api, { uploadUrl } from "../../lib/api";
import { toDateInputValue } from "../../lib/dates";
import { Button } from "../../components/ui/button";
import { Field, Input, Select } from "../../components/ui/field";
import { skillNames } from "./peopleUtils";

const EMPTY = {
  firstName: "", lastName: "", email: "", personalEmail: "", phone: "", skills: "",
  hireDate: "", role: "", position: "", salary: "", departmentId: "", password: "",
};

// Only these fields are ever sent; never the whole user document.
const EDITABLE_FIELDS = Object.keys(EMPTY);
const REQUIRED_ON_CREATE = ["firstName", "lastName", "email", "personalEmail", "phone", "position", "role", "salary", "hireDate"];

const toFormValues = (person) => ({
  ...EMPTY,
  ...Object.fromEntries(EDITABLE_FIELDS.map((key) => [key, person?.[key] ?? ""])),
  skills: skillNames(person?.skills).join(", "),
  hireDate: toDateInputValue(person?.hireDate),
  departmentId: person?.department?.id || person?.departmentId?._id || person?.departmentId || "",
  salary: "", // never pre-filled: it is only shown through the audited reveal
  password: "",
});

const validationMessage = (error) => {
  const errors = error.response?.data?.errors;
  if (Array.isArray(errors)) return errors.map((e) => e.msg).join(" ");
  return error.response?.data?.message || "Could not save. Please try again.";
};

/**
 * Add (person = null) or edit someone. Rendered inside the profile drawer.
 * Salary is never pre-filled: leave it empty to keep the current value.
 */
export function EmployeeForm({ person, departments = [], onSaved, onCancel }) {
  const editing = Boolean(person);
  const [values, setValues] = useState(() => toFormValues(person));
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(person?.profilePicture ? uploadUrl(person.profilePicture) : null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => () => {
    if (preview?.startsWith("blob:")) URL.revokeObjectURL(preview);
  }, [preview]);

  const set = (name) => (e) => setValues((v) => ({ ...v, [name]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    if (!editing) {
      const missing = REQUIRED_ON_CREATE.filter((f) => !values[f]);
      if (missing.length) return setError(`Please fill in: ${missing.join(", ")}.`);
    }
    const form = new FormData();
    EDITABLE_FIELDS.forEach((f) => {
      if (editing && f === "role") return; // fixed after creation
      if (values[f] !== "" && values[f] != null) form.append(f, values[f]);
    });
    if (file) form.append("profilePicture", file);
    setSaving(true);
    try {
      if (editing) await api.put(`/api/users/${person.id}`, form);
      else await api.post("/api/users", form);
      onSaved(editing ? "Changes saved" : "Person added. A set-password link was emailed to them.");
    } catch (err) {
      setError(validationMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="grid gap-3">
      {error && (
        <p role="alert" className="rounded-md border border-red/30 bg-red/10 px-3 py-2 text-sm text-red">
          {error}
        </p>
      )}
      <div className="flex items-center gap-3">
        {preview ? (
          <img src={preview} alt="" className="h-14 w-14 rounded-[14px] border border-line-2 object-cover" />
        ) : (
          <span className="grid h-14 w-14 place-items-center rounded-[14px] border border-dashed border-line-2 text-xs text-ink-3">Photo</span>
        )}
        <Field label="Photo (JPG or PNG, max 2 MB)" className="flex-1">
          <Input
            type="file"
            accept="image/png, image/jpeg"
            className="h-auto py-1.5 file:mr-3 file:rounded file:border-0 file:bg-sunk file:px-2 file:py-1 file:text-ink"
            onChange={(e) => {
              const f = e.target.files[0];
              if (f) {
                setFile(f);
                setPreview(URL.createObjectURL(f));
              }
            }}
          />
        </Field>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="First name" required={!editing}><Input value={values.firstName} onChange={set("firstName")} /></Field>
        <Field label="Last name" required={!editing}><Input value={values.lastName} onChange={set("lastName")} /></Field>
        <Field label="Work email (login)" required><Input type="email" value={values.email} onChange={set("email")} /></Field>
        <Field label="Personal email" required={!editing}><Input type="email" value={values.personalEmail} onChange={set("personalEmail")} /></Field>
        <Field label="Phone" required={!editing}><Input value={values.phone} onChange={set("phone")} inputMode="tel" /></Field>
        <Field label="Position" required={!editing}><Input value={values.position} onChange={set("position")} /></Field>
        <Field label="Hire date" required={!editing}><Input type="date" value={values.hireDate} onChange={set("hireDate")} /></Field>
        <Field label="Salary (DT)" required={!editing} hint={editing ? "Leave empty to keep the current salary." : undefined}>
          <Input type="number" min="0" step="0.01" value={values.salary} onChange={set("salary")} placeholder={editing ? "Unchanged" : ""} />
        </Field>
        <Field label="Access" required={!editing} hint={editing ? "Fixed after creation." : undefined}>
          <Select value={values.role} onChange={set("role")} disabled={editing}>
            <option value="">Select</option>
            <option value="employee">Employee</option>
            <option value="manager">Manager</option>
          </Select>
        </Field>
        <Field label="Department">
          <Select value={values.departmentId} onChange={set("departmentId")}>
            <option value="">No department</option>
            {departments.map((d) => <option key={d._id} value={d._id}>{d.name}</option>)}
          </Select>
        </Field>
      </div>
      <Field label="Skills" hint="Comma-separated. Levels are rated from the profile.">
        <Input value={values.skills} onChange={set("skills")} placeholder="ROS 2, Embedded C, SolidWorks" />
      </Field>
      <Field
        label={editing ? "New password (optional)" : "Initial password (optional)"}
        hint={editing ? "Leave empty to keep the current password. They are told (without the password) if it changes." : "Leave empty: they receive an email link to choose their own."}
      >
        <Input type="password" value={values.password} onChange={set("password")} autoComplete="new-password" />
      </Field>
      <div className="flex flex-wrap gap-2 pt-1">
        <Button type="submit" disabled={saving}>{saving ? "Saving…" : editing ? "Save changes" : "Add person"}</Button>
        <Button variant="ghost" onClick={onCancel}>Cancel</Button>
      </div>
    </form>
  );
}
