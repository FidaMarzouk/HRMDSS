import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Dialog } from "../../components/ui/dialog";
import { Button } from "../../components/ui/button";
import { useAuth } from "../../context/AuthContext";
import api, { errorMessage } from "../../lib/api";
import { showError } from "../../lib/alerts";
import { queryClient, useTodaySessions } from "../../lib/queries";
import { formatClock, formatDuration, summarizeSessions } from "../time/sessions";

// Logout that knows your shift: if you are still punched in, punching out is
// offered first, because logging out alone does not end the shift.
export function LogoutDialog({ open, onClose }) {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const { data } = useTodaySessions();
  const [busy, setBusy] = useState(false);
  const shift = summarizeSessions(data || []);
  const workingNow = shift.state === "in" || shift.state === "break";

  const leave = async ({ punchOut }) => {
    setBusy(true);
    try {
      // Punching out also closes a break left open (attendanceController.punchOut).
      if (punchOut) await api.post("/api/attendance/punch-out");
      await logout();
      queryClient.clear();
      navigate("/", { replace: true });
    } catch (err) {
      showError("Could not punch out", errorMessage(err));
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={busy ? undefined : onClose}
      title={workingNow ? "You're still punched in" : "Log out?"}
      description={
        workingNow
          ? `You've worked ${formatDuration(shift.workedMinutes)} today since ${formatClock(shift.since)}. Logging out doesn't punch you out. Unsaved changes on this page will be lost.`
          : "You'll return to the login page. Unsaved changes on this page will be lost."
      }
    >
      <div className="grid gap-2">
        {workingNow && (
          <Button onClick={() => leave({ punchOut: true })} disabled={busy}>
            Punch out and log out
          </Button>
        )}
        <Button variant={workingNow ? "secondary" : "primary"} onClick={() => leave({ punchOut: false })} disabled={busy}>
          {workingNow ? "Log out only" : "Log out"}
        </Button>
        <Button variant="ghost" onClick={onClose} disabled={busy}>
          Cancel
        </Button>
      </div>
    </Dialog>
  );
}
