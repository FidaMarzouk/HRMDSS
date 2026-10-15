import { FaCheckCircle, FaTimesCircle } from "react-icons/fa";
import {
  AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "../../components/ui/alert-dialog";
import LeaveStatusBadge from "./LeaveStatusBadge";
import { countWorkingDays, formatDate, fullName } from "./leaveUtils";

const Field = ({ label, children, wide }) => (
  <div className={`bg-[#2a2a2a] p-4 rounded-lg ${wide ? "col-span-2" : ""}`}>
    <p className="text-sm font-semibold text-[#33adb4] mb-1">{label}</p>
    <div className="text-base font-medium text-white">{children}</div>
  </div>
);

// Shows a request's details. With `action` set ("approve" | "reject") it also asks for confirmation.
const LeaveDecisionDialog = ({ request, action, onConfirm, onClose, busy }) => {
  const title = action === "approve" ? "Approve leave request" : action === "reject" ? "Reject leave request" : "Leave request details";

  return (
    <AlertDialog open={Boolean(request)} onOpenChange={(value) => !value && onClose()}>
      <AlertDialogContent className="max-w-[600px] p-0 overflow-hidden !bg-[#222] border !border-[#333] !text-white">
        <AlertDialogHeader className="px-6 py-4 !bg-[#33adb4]">
          <AlertDialogTitle className="text-2xl font-bold text-white">{title}</AlertDialogTitle>
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
            <p className="text-gray-400 text-base">
              Are you sure you want to {action} this leave request? The employee will be notified.
            </p>
          )}
          <AlertDialogFooter className="mt-6 space-x-3">
            <button type="button" onClick={onClose} className="px-4 py-2 bg-[#333] hover:bg-[#444] text-gray-300 rounded-lg transition-colors">
              {action ? "Cancel" : "Close"}
            </button>
            {action && (
              <button
                type="button"
                onClick={onConfirm}
                disabled={busy}
                className={`px-4 py-2 rounded-lg flex items-center justify-center min-w-[120px] transition-colors text-white disabled:opacity-50 ${
                  action === "approve" ? "bg-[#33adb4] hover:bg-[#2a8c92]" : "bg-[#b91c1c] hover:bg-[#991b1b]"
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
