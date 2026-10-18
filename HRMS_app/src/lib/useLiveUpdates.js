import { useCallback, useEffect } from "react";
import { useSocketEvent } from "../context/SocketContext";
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
    // Bookings and approvals made elsewhere change lanes and clashes.
    queryClient.invalidateQueries({ queryKey: ["calendar"] });
  }, []);

  const onNotification = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: keys.counts });
  }, []);

  useSocketEvent("presence:changed", onPresence);
  useSocketEvent("queue:changed", onQueue);
  useSocketEvent("notification", onNotification);
  useSocketEvent("newMessage", onNotification);
  useSocketEvent("messagesRead", onNotification);

  // Pages that mark notifications read announce it with a window event.
  useEffect(() => {
    window.addEventListener("notifications:changed", onNotification);
    return () => window.removeEventListener("notifications:changed", onNotification);
  }, [onNotification]);
}
