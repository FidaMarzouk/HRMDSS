import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Check, Clock, Eye, MapPin, Pencil, Trash2, User, X } from "lucide-react";
import { Drawer } from "../../components/ui/dialog";
import { Button } from "../../components/ui/button";
import { StatusGlyph, StatusPill } from "../../components/ui/status-pill";
import { confirmAction } from "../../lib/alerts";
import { toDayKey } from "../../lib/dates";
import { useAuth } from "../../context/AuthContext";
import { EVENT_TYPES, FallbackIcon, STATE_LABEL, STATE_PILL, VISIBILITY, stateOf } from "./meta";
import { clock, formatKey } from "./time";
import { checkAvailability, deleteEvent, respondToEvent, reviewEvent } from "./calendarApi";

const name = (u) => (u ? `${u.firstName || ""} ${u.lastName || ""}`.trim() : "");
const idOf = (v) => (v && typeof v === "object" ? v._id : v);
const RESPONSE = { accepted: "approved", declined: "rejected", pending: "pending" };

function Row({ icon: Icon, children }) {
  return (
    <p className="flex items-start gap-2 text-[13px] text-ink-2">
      <Icon className="mt-0.5 h-4 w-4 flex-none text-ink-3" aria-hidden />
      <span className="min-w-0">{children}</span>
    </p>
  );
}

/**
 * Event details and the actions the viewer may take: edit and delete
 * (organiser or HR), accept or decline (invited), approve or decline (HR).
 * `event` may be a lane booking the viewer cannot see in full (private).
 */
export function EventDrawer({ event, onClose, onEdit }) {
  const { user } = useAuth();
  const open = Boolean(event);
  const resourceId = idOf(event?.resource);
  const overlaps = useQuery({
    queryKey: ["calendar", "overlaps", event?._id, event?.startDateTime, event?.endDateTime],
    queryFn: () => checkAvailability({ resourceId, startDateTime: event.startDateTime, endDateTime: event.endDateTime, eventId: event._id }),
    enabled: open && Boolean(resourceId) && event?.status !== "declined",
  });

  if (!event) return <Drawer open={false} onClose={onClose} />;

  const state = stateOf(event);
  const { Icon = FallbackIcon, label } = EVENT_TYPES[event.eventType] || {};
  const me = String(user?.id);
  const organiser = idOf(event.createdBy) && String(idOf(event.createdBy)) === me;
  const admin = user?.role === "admin" || user?.role === "superAdmin";
  const invite = (event.usersInvolved || []).find((u) => String(idOf(u.userId)) === me);
  const canReview = user?.role === "admin" && event.status === "pending";
  const confirmed = overlaps.data?.conflictingEvents || [];
  const pending = overlaps.data?.pendingClashes || [];
  const startKey = toDayKey(event.startDateTime);
  const endKey = toDayKey(event.endDateTime);
  const where = event.resource?.name || event.location;

  const remove = async () => {
    if (await confirmAction("Delete this event?", "It is removed for everyone invited. This cannot be undone.", "Delete event")) {
      if (await deleteEvent(event._id)) onClose();
    }
  };
  const review = async (status) => {
    const result = await reviewEvent(event._id, status);
    if (result.ok) onClose();
  };
  const respond = async (status) => {
    if (await respondToEvent(event._id, status)) onClose();
  };

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={event.title}
      description={
        <span className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1"><Icon className="h-3.5 w-3.5" aria-hidden /> {label}</span>
          <StatusPill status={STATE_PILL[state]}>{STATE_LABEL[state]}</StatusPill>
        </span>
      }
      footer={
        <>
          {invite && !organiser && event.status !== "declined" && (
            <>
              <Button variant="secondary" onClick={() => respond("declined")} disabled={invite.status === "declined"}>Decline invitation</Button>
              <Button variant={canReview ? "secondary" : "primary"} onClick={() => respond("accepted")} disabled={invite.status === "accepted"}>Accept invitation</Button>
            </>
          )}
          {canReview && (
            <>
              <Button variant="danger" onClick={() => review("declined")}><X aria-hidden /> Decline</Button>
              <Button onClick={() => review("approved")} disabled={confirmed.length > 0} title={confirmed.length ? "A confirmed booking overlaps this one" : undefined}>
                <Check aria-hidden /> Approve
              </Button>
            </>
          )}
        </>
      }
    >
      <div className="grid gap-4">
        <div className="grid gap-2">
          <Row icon={Clock}>
            <span className="figure">
              {formatKey(startKey, { weekday: "long", day: "numeric", month: "long" })}, {clock(event.startDateTime)}–{endKey !== startKey ? `${formatKey(endKey)}, ` : ""}{clock(event.endDateTime)}
            </span>
          </Row>
          {where && <Row icon={MapPin}>{where}{event.resource && event.location && event.location !== event.resource.name ? ` · ${event.location}` : ""}</Row>}
          {event.destination && <Row icon={MapPin}>Destination: {event.destination}</Row>}
          {event.createdBy && <Row icon={User}>Organised by {name(event.createdBy) || event.by?.name}</Row>}
          {event.visibility && <Row icon={Eye}>Visible to {VISIBILITY[event.visibility]?.toLowerCase() || event.visibility}</Row>}
          {event.private && <p className="text-[12.5px] text-ink-3">This booking is private: only its organiser, the people invited and HR see the details.</p>}
        </div>

        {(confirmed.length > 0 || pending.length > 0) && (
          <div className="grid gap-1.5 rounded-lg border border-red/40 bg-red/5 p-3 text-[12.5px]" role="status">
            <p className="flex items-center gap-1.5 font-semibold text-red"><AlertTriangle className="h-4 w-4" aria-hidden /> Overlaps on {event.resource?.name || "this resource"}</p>
            {confirmed.map((c) => (
              <p key={c.id} className="text-ink-2">Confirmed: <span className="text-ink">{c.title}</span> · {c.by} · <span className="figure">{clock(c.startDateTime)}–{clock(c.endDateTime)}</span></p>
            ))}
            {pending.map((c) => (
              <p key={c.id} className="text-ink-2">Pending: <span className="text-ink">{c.title}</span> · {c.by} · <span className="figure">{clock(c.startDateTime)}–{clock(c.endDateTime)}</span></p>
            ))}
            <p className="text-ink-3">{confirmed.length ? "It cannot be approved while a confirmed booking overlaps it." : "Approving one of these requests blocks the others."}</p>
          </div>
        )}

        {event.description && (
          <div>
            <p className="label-key mb-1">Description</p>
            <p className="whitespace-pre-line rounded-lg bg-sunk/60 p-3 text-[13px] text-ink">{event.description}</p>
          </div>
        )}

        {event.usersInvolved?.length > 0 && (
          <div>
            <p className="label-key mb-1">People invited</p>
            <ul className="grid gap-1">
              {event.usersInvolved.map((u) => (
                <li key={idOf(u.userId)} className="flex items-center justify-between gap-2 text-[13px]">
                  <span className="text-ink">{name(u.userId) || "Former employee"}</span>
                  <span className="flex items-center gap-1.5 text-[12px] text-ink-2"><StatusGlyph status={RESPONSE[u.status]} /> {u.status}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {(organiser || admin) && !event.private && (
          <div className="flex gap-2 border-t border-line pt-3">
            <Button variant="secondary" size="sm" onClick={() => onEdit(event)}><Pencil aria-hidden /> Edit</Button>
            <Button variant="danger" size="sm" onClick={remove}><Trash2 aria-hidden /> Delete</Button>
          </div>
        )}
      </div>
    </Drawer>
  );
}
