import { useEffect, useState } from "react";
import DatePicker from "react-datepicker";
import { format } from "date-fns";
import { FaCalendarAlt, FaCheckCircle } from "react-icons/fa";
import "react-datepicker/dist/react-datepicker.css";
import "../../datepicker.css";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription } from "../../components/ui/alert-dialog";
import api, { errorMessage } from "../../lib/api";
import { showError, showSuccess } from "../../lib/alerts";
import { LEAVE_TYPES, countWorkingDays, fullName } from "./leaveUtils";

const ROLE_NAMES = { manager: "Manager", admin: "HR Administrator", superAdmin: "CEO" };

const todayString = () => format(new Date(), "yyyy-MM-dd");

// Modal for submitting a leave request. The backend decides who approves it;
// the form only shows that person.
const LeaveRequestForm = ({ open, onClose, onCreated }) => {
  const [form, setForm] = useState({ startDate: todayString(), endDate: todayString(), reason: "" });
  const [errors, setErrors] = useState({});
  const [approver, setApprover] = useState(undefined); // undefined = loading, null = none
  const [remainingDays, setRemainingDays] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm({ startDate: todayString(), endDate: todayString(), reason: "" });
    setErrors({});
    setApprover(undefined);
    api.get("/api/leave-requests/approver")
      .then(({ data }) => setApprover(data.approver || null))
      .catch(() => setApprover(null));
    api.get("/api/users/remaining-leave-days")
      .then(({ data }) => setRemainingDays(data.remainingLeaveDays ?? null))
      .catch(() => setRemainingDays(null));
  }, [open]);

  const requestedDays = countWorkingDays(form.startDate, form.endDate);

  const setField = (name, value) => {
    setForm((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => ({ ...prev, [name]: "" }));
  };

  const validate = () => {
    const next = {};
    if (!form.startDate) next.startDate = "Start date is required";
    if (!form.endDate) next.endDate = "End date is required";
    else if (form.endDate < form.startDate) next.endDate = "End date must be on or after the start date";
    if (!form.reason) next.reason = "Please choose a leave type";
    if (!next.endDate && form.startDate && form.endDate && requestedDays === 0) {
      next.endDate = "The selected period has no working days";
    }
    if (!next.endDate && remainingDays !== null && requestedDays > remainingDays) {
      next.endDate = `You only have ${remainingDays} day(s) left`;
    }
    return next;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const validation = validate();
    if (Object.keys(validation).length > 0) {
      setErrors(validation);
      return;
    }
    setSubmitting(true);
    try {
      await api.post("/api/leave-requests/create", form);
      showSuccess("Leave request submitted", "Your request has been sent for approval.");
      onCreated?.();
      onClose();
    } catch (err) {
      showError("Could not submit request", errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const dateField = (name, label) => (
    <div>
      <label className="block text-sm font-medium text-ink mb-1">{label}</label>
      <div className="custom-datepicker-container relative">
        <DatePicker
          selected={form[name] ? new Date(form[name]) : null}
          onChange={(date) => setField(name, date ? format(date, "yyyy-MM-dd") : "")}
          dateFormat="dd/MM/yyyy"
          className={`w-full p-2 pl-9 bg-raise border rounded-md text-ink ${errors[name] ? "border-red" : "border-line-2"}`}
        />
        <FaCalendarAlt className="absolute left-3 top-1/2 -translate-y-1/2 text-teal" />
      </div>
      {errors[name] && <p className="text-red text-sm mt-1">{errors[name]}</p>}
    </div>
  );

  return (
    <AlertDialog open={open} onOpenChange={(value) => !value && onClose()}>
      <AlertDialogContent className="max-w-[700px] max-h-[90vh] p-0 overflow-hidden">
        <AlertDialogHeader className="px-6 py-4 border-b border-line">
          <AlertDialogTitle className="text-2xl font-bold text-ink">Request Leave</AlertDialogTitle>
          <AlertDialogDescription className="sr-only">Choose the dates and type of leave to request.</AlertDialogDescription>
        </AlertDialogHeader>

        <div className="px-6 py-4 overflow-y-auto max-h-[calc(90vh-80px)]">
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="bg-panel p-3 rounded-md border border-line">
              <span className="text-xs text-ink-2 block">Remaining balance</span>
              <span className="text-2xl font-semibold text-teal">{remainingDays ?? "--"}</span>
              <span className="text-xs text-ink-2"> working days</span>
            </div>
            <div className="bg-panel p-3 rounded-md border border-line">
              <span className="text-xs text-ink-2 block">This request</span>
              <span className="text-2xl font-semibold text-ink">{requestedDays}</span>
              <span className="text-xs text-ink-2"> working days (Mon–Fri)</span>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {dateField("startDate", "Start date")}
              {dateField("endDate", "End date")}
            </div>

            <div>
              <label className="block text-sm font-medium text-ink mb-1">Leave type</label>
              <select
                value={form.reason}
                onChange={(e) => setField("reason", e.target.value)}
                className={`w-full p-2 bg-raise border rounded-md text-ink ${errors.reason ? "border-red" : "border-line-2"}`}
              >
                <option value="">Select a leave type</option>
                {LEAVE_TYPES.map((type) => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
              {errors.reason && <p className="text-red text-sm mt-1">{errors.reason}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-ink mb-1">Will be reviewed by</label>
              <div className="p-2 bg-raise border border-line-2 rounded-md">
                {approver === undefined && <span className="text-ink-3">Loading…</span>}
                {approver === null && (
                  <span className="text-amber">No approver assigned. Please contact HR before requesting leave.</span>
                )}
                {approver && (
                  <span className="text-ink">
                    {fullName(approver)} <span className="text-ink-2">({ROLE_NAMES[approver.role] || approver.role})</span>
                  </span>
                )}
              </div>
            </div>

            <div className="flex justify-end space-x-3 pt-2">
              <button type="button" onClick={onClose} className="px-4 py-2 bg-sunk hover:bg-line text-ink rounded-lg transition-colors">
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting || approver === null}
                className="px-4 py-2 bg-teal hover:bg-teal-hi disabled:opacity-50 disabled:cursor-not-allowed text-on-accent rounded-lg transition-colors flex items-center"
              >
                <FaCheckCircle className="mr-2" />
                {submitting ? "Submitting…" : "Submit request"}
              </button>
            </div>
          </form>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default LeaveRequestForm;
