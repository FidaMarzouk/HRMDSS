import { StatusPill } from "../../components/ui/status-pill";
import { statusKind } from "./leaveUtils";

const LeaveStatusBadge = ({ status }) => <StatusPill status={statusKind(status)}>{status}</StatusPill>;

export default LeaveStatusBadge;
