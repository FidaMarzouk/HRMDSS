import { useCallback } from "react";
import { useSocketEvent } from "../context/SocketContext";
import { toast } from "./feedback";
import { keys, queryClient } from "./queries";

// Refetch shell data when the server announces a change. The events carry no
// data: each client refetches only what it is allowed to see.
export default function useLiveUpdates() {
  const onPresence = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: keys.presence });
    queryClient.invalidateQueries({ queryKey: keys.today });
    queryClient.invalidateQueries({ queryKey: keys.attendanceToday });
  }, []);

  const onQueue = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: keys.today });
    queryClient.invalidateQueries({ queryKey: keys.counts });
    // Bookings and approvals made elsewhere change lanes, clashes and inbox cards.
    queryClient.invalidateQueries({ queryKey: ["calendar"] });
    queryClient.invalidateQueries({ queryKey: ["inbox"] });
  }, []);

  // A notification pushed to this person (held digest items are never pushed):
  // show it briefly and refresh the inbox and the bell.
  const onNotification = useCallback((n) => {
    queryClient.invalidateQueries({ queryKey: keys.counts });
    queryClient.invalidateQueries({ queryKey: ["inbox"] });
    // During quiet hours non-urgent notifications arrive silently (no pop-up).
    if (n?.title && !n.silent) toast({ tone: n.priority === "urgent" ? "warning" : "info", title: n.title, text: n.message });
  }, []);

  const onChat = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: keys.counts });
  }, []);

  // This session was ended from another device or by a password change.
  const onSessionEnded = useCallback(({ reason } = {}) => {
    window.location.assign(`/?ended=${encodeURIComponent(reason || "signed_out_elsewhere")}`);
  }, []);

  useSocketEvent("session:ended", onSessionEnded);
  useSocketEvent("presence:changed", onPresence);
  useSocketEvent("queue:changed", onQueue);
  useSocketEvent("notification", onNotification);
  useSocketEvent("newMessage", onChat);
  useSocketEvent("messagesRead", onChat);
}
