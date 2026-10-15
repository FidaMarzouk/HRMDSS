import { statusColor } from "./leaveUtils";

const LeaveStatusBadge = ({ status }) => {
  const color = statusColor(status);
  return (
    <span
      className="px-2 py-1 rounded-full text-xs font-medium whitespace-nowrap"
      style={{ backgroundColor: `${color}33`, color, border: `1px solid ${color}` }}
    >
      {status}
    </span>
  );
};

export default LeaveStatusBadge;
