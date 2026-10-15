import { cn } from "../../lib/utils";
import { uploadUrl } from "../../lib/api";

const PRESENCE = {
  in: { dot: "bg-teal", label: "In" },
  late: { dot: "bg-amber", label: "Late" },
  leave: { dot: "bg-ink-3", label: "On leave" },
  out: { dot: "bg-line-2", label: "Not in" },
};

const SIZES = {
  sm: "h-7 w-7 text-[10px]",
  md: "h-[34px] w-[34px] text-[11.5px]",
  lg: "h-14 w-14 rounded-[14px] text-lg",
};

const initialsOf = (user) => `${user?.firstName?.[0] || ""}${user?.lastName?.[0] || ""}`.toUpperCase() || "?";

// Photo or initials, with an optional presence dot ("in", "late", "leave", "out").
export function Avatar({ user, size = "md", presence, className }) {
  const status = presence && PRESENCE[presence];
  return (
    <span
      className={cn(
        "relative grid flex-none place-items-center rounded-full border border-line-2 bg-raise font-semibold text-ink",
        SIZES[size],
        className
      )}
    >
      {user?.profilePicture ? (
        <img src={uploadUrl(user.profilePicture)} alt="" className="h-full w-full rounded-[inherit] object-cover" />
      ) : (
        <span aria-hidden="true">{initialsOf(user)}</span>
      )}
      {status && (
        <span className={cn("absolute -bottom-0.5 -right-0.5 h-[11px] w-[11px] rounded-full border-2 border-panel", status.dot)}>
          <span className="sr-only">{status.label}</span>
        </span>
      )}
    </span>
  );
}
