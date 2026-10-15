import { useCallback, useEffect, useState } from "react";
import api from "./api";
import { useSocketEvent } from "../context/SocketContext";

const REFRESH_MS = 60_000;

// Unread notification count, refreshed on socket pushes, on local read/delete
// events and on a slow interval as a safety net.
export default function useUnreadNotifications() {
  const [unread, setUnread] = useState(0);

  const refresh = useCallback(async () => {
    try {
      const { data } = await api.get("/api/notifications");
      setUnread(Array.isArray(data) ? data.filter((n) => !n.isRead).length : 0);
    } catch {
      // keep the previous count
    }
  }, []);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, REFRESH_MS);
    window.addEventListener("notifications:changed", refresh);
    return () => {
      clearInterval(interval);
      window.removeEventListener("notifications:changed", refresh);
    };
  }, [refresh]);

  useSocketEvent("notification", refresh);

  return unread;
}

// Lets pages that modify notifications tell the badge to refresh.
export const notifyNotificationsChanged = () => window.dispatchEvent(new Event("notifications:changed"));
