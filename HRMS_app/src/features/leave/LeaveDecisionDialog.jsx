import { FaCheckCircle, FaTimesCircle } from "react-icons/fa";
import {
  AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "../../components/ui/alert-dialog";
import LeaveStatusBadge from "./LeaveStatusBadge";
import { countWorkingDays, formatDate, fullName } from "./leaveUtils";

const Field = ({ label, children, wide }) => (
  <div className={`bg-raise p-4 rounded-lg ${wide ? "col-span-2" : ""}`}>
    <p className="text-sm font-semibold text-teal mb-1">{label}</p>
    <div className="text-base font-medium text-ink">{children}</div>
  </div>
);

// Shows a request's details. With `action` set ("approve" | "reject") it also asks for confirmation.
const LeaveDecisionDialog = ({ request, action, onConfirm, onClose, busy }) => {
  const title = action === "approve" ? "Approve leave request" : action === "reject" ? "Reject leave request" : "Leave request details";

  return (
    <AlertDialog open={Boolean(request)} onOpenChange={(value) => !value && onClose()}>
      <AlertDialogContent className="max-w-[600px] p-0 overflow-hidden">
        <AlertDialogHeader className="px-6 py-4 border-b border-line">
          <AlertDialogTitle className="text-2xl font-bold text-ink">{title}</AlertDialogTitle>
          <AlertDialogDescription className="sr-only">Leave request details</AlertDialogDescription>
        </AlertDialogHeader>

        {request && (
          <div className="m-6 grid grid-cols-2 gap-4">
            <Field label="Employee">{fullName(request.employeeId)}</Field>
            <Field label="Reviewer">{fullName(request.managerId)}</Field>
            <Field label="Start date">{formatDate(request.startDate)}</Field>
            <Field label="End date">{formatDate(request.endDate)}</Field>
            <Field label="Leave type">{request.reason}</Field>
            <Field label="Working days">{countWorkingDays(request.startDate, request.endDate)}</Field>
            <Field label="Status" wide><LeaveStatusBadge status={request.status} /></Field>
          </div>
        )}

        <div className="px-6 pb-6">
          {action && (
            <p className="text-ink-2 text-base">
              Are you sure you want to {action} this leave request? The employee will be notified.
            </p>
          )}
          <AlertDialogFooter className="mt-6 space-x-3">
            <button type="button" onClick={onClose} className="px-4 py-2 bg-sunk hover:bg-line text-ink rounded-lg transition-colors">
              {action ? "Cancel" : "Close"}
            </button>
            {action && (
              <button
                type="button"
                onClick={onConfirm}
                disabled={busy}
                className={`px-4 py-2 rounded-lg flex items-center justify-center min-w-[120px] transition-colors text-ink disabled:opacity-50 ${
                  action === "approve" ? "bg-teal hover:bg-teal-hi" : "bg-red hover:bg-red"
                }`}
              >
                {action === "approve" ? <FaCheckCircle className="mr-2" /> : <FaTimesCircle className="mr-2" />}
                {action === "approve" ? "Approve" : "Reject"}
              </button>
            )}
          </AlertDialogFooter>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default LeaveDecisionDialog;
