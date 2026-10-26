import { Bell, CalendarDays, Clipboard, Clock, Inbox as InboxIcon, Trash2 } from "lucide-react";
import { SegmentedControl } from "../../components/ui/segmented-control";
import { Switch } from "../../components/ui/switch";
import { Button } from "../../components/ui/button";
import { cn } from "../../lib/utils";
import { RequestCard } from "./RequestCard";
import { deleteNotification, markInfoRead, markRead, setDigest, useInbox } from "./inboxApi";

const ICON = { leave: Clipboard, event: CalendarDays, correction: Clock, digest: InboxIcon };
const kindOf = (n) => (n.type === "digest" ? "digest" : n.card?.kind || (n.type?.startsWith("leave") ? "leave" : n.type?.startsWith("event") ? "event" : n.type === "attendance_correction" ? "correction" : null));

const ago = (value) => {
  const d = new Date(value);
  const mins = Math.round((Date.now() - d.getTime()) / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} h ago`;
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
};

function Item({ n, box }) {
  const Icon = ICON[kindOf(n)] || Bell;
  return (
    <li className={cn("grid grid-cols-[32px_minmax(0,1fr)] gap-3 border-t border-line py-3 first:border-t-0", box === "info" && n.isRead && "opacity-70")}>
      <span className="grid h-8 w-8 place-items-center rounded-lg border border-line-2 bg-raise text-teal" aria-hidden="true">
        <Icon className="h-4 w-4" />
      </span>
      <div className="grid min-w-0 gap-1.5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="flex flex-wrap items-center gap-1.5 text-[13.5px] font-medium text-ink">
              {!n.isRead && <span className="h-2 w-2 flex-none rounded-full bg-teal" aria-label="Unread" />}
              {n.title}
              {n.priority === "urgent" && <span className="rounded border border-red/40 px-1 font-mono text-[10px] uppercase tracking-[0.08em] text-red">Urgent</span>}
              {n.held && <span className="rounded border border-line-2 px-1 font-mono text-[10px] uppercase tracking-[0.08em] text-ink-3">In 09:00 digest</span>}
            </p>
            <p className="text-[12.5px] text-ink-2">{n.message}</p>
          </div>
          <span className="figure flex-none text-[11px] text-ink-3">{ago(n.createdAt)}</span>
        </div>
        {n.card && <RequestCard card={n.card} />}
        <div className="flex gap-1">
          {!n.isRead && (
            <Button size="sm" variant="ghost" onClick={() => markRead(n._id)}>
              Mark read
            </Button>
          )}
          {box === "info" && (
            <Button size="sm" variant="ghost" onClick={() => deleteNotification(n._id)} aria-label={`Delete: ${n.title}`}>
              <Trash2 aria-hidden />
            </Button>
          )}
        </div>
      </div>
    </li>
  );
}

/**
 * Notifications sorted by what you can do: "Needs action" (with the actions
 * inline) and "For information". The daily digest switch holds low-urgency
 * alerts for one 09:00 summary.
 */
export function NotificationsPane({ box, onBox }) {
  const { data, isLoading, isError } = useInbox(box);
  const counts = data?.counts || {};
  const digest = Boolean(data?.preferences?.digest);
  const list = data?.notifications || [];

  return (
    <section aria-label="Notifications" className="grid content-start gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <SegmentedControl
          label="Notifications"
          value={box}
          onChange={onBox}
          options={[
            { value: "action", label: `Needs action${counts.action ? ` ${counts.action}` : ""}` },
            { value: "info", label: `For information${counts.infoUnread ? ` ${counts.infoUnread}` : ""}` },
          ]}
        />
        {box === "info" && counts.infoUnread > 0 && (
          <Button size="sm" variant="ghost" onClick={markInfoRead}>
            Mark all read
          </Button>
        )}
      </div>
      <div className="flex items-center justify-between gap-3 rounded-lg border border-line bg-raise px-3 py-2">
        <div className="min-w-0 text-[12.5px]">
          <p className="font-medium text-ink">Daily digest at 09:00</p>
          <p className="text-ink-3">{digest ? "Low-urgency alerts arrive in one summary on working days; urgent ones still arrive right away." : "Off: alerts arrive as they happen."}</p>
        </div>
        <Switch checked={digest} onChange={setDigest} label="Daily digest at 09:00" disabled={!data} />
      </div>
      {isError ? (
        <p role="alert" className="text-[13px] text-red">The inbox could not be loaded.</p>
      ) : isLoading ? (
        <div className="h-48 animate-pulse rounded-lg bg-sunk" />
      ) : list.length === 0 ? (
        <p className="rounded-lg border border-dashed border-line-2 px-4 py-8 text-center text-[13px] text-ink-3">
          {box === "action" ? "Nothing needs your action." : "No notifications."}
        </p>
      ) : (
        <ul>
          {list.map((n) => (
            <Item key={n._id} n={n} box={box} />
          ))}
        </ul>
      )}
    </section>
  );
}
