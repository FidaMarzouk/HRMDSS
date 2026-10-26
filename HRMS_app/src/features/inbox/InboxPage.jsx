import { useSearchParams } from "react-router-dom";
import { SegmentedControl } from "../../components/ui/segmented-control";
import { useCounts } from "../../lib/queries";
import { cn } from "../../lib/utils";
import { NotificationsPane } from "./NotificationsPane";
import { ChatPane } from "./ChatPane";

/**
 * Inbox: notifications sorted by what you can do, next to chat. On narrow
 * screens one of the two shows at a time (?tab=notifications|messages).
 * ?box=action|info picks the notification box, ?with=<id> opens a conversation.
 */
export default function InboxPage() {
  const [params, setParams] = useSearchParams();
  const counts = useCounts();
  const partnerId = params.get("with") || null;
  const tab = params.get("tab") === "messages" || partnerId ? "messages" : "notifications";
  const box = params.get("box") === "info" ? "info" : "action";
  const go = (changes) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        Object.entries(changes).forEach(([k, v]) => (v == null ? next.delete(k) : next.set(k, v)));
        return next;
      },
      { replace: true }
    );

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="label-key">Sorted by what you can do</p>
          <h2 className="font-display text-2xl font-bold leading-tight">Inbox</h2>
        </div>
        <SegmentedControl
          className="xl:hidden"
          label="Show"
          value={tab}
          onChange={(v) => go({ tab: v, with: v === "notifications" ? null : partnerId })}
          options={[
            { value: "notifications", label: `Notifications${counts.data?.notifications ? ` ${counts.data.notifications}` : ""}` },
            { value: "messages", label: `Messages${counts.data?.chat ? ` ${counts.data.chat}` : ""}` },
          ]}
        />
      </div>
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)]">
        <div className={cn(tab !== "notifications" && "hidden xl:block")}>
          <NotificationsPane box={box} onBox={(v) => go({ box: v === "action" ? null : v })} />
        </div>
        <div className={cn(tab !== "messages" && "hidden xl:block")}>
          <p className="label-key mb-2 hidden xl:block">Messages</p>
          <ChatPane partnerId={partnerId} onOpen={(id) => go({ with: id, tab: "messages" })} />
        </div>
      </div>
    </div>
  );
}
