import { createContext, useContext, useEffect, useState } from "react";
import { io } from "socket.io-client";
import { API_URL } from "../lib/api";
import { useAuth } from "./AuthContext";

const SocketContext = createContext(null);

// One authenticated socket per signed-in session, shared by every component.
// The server authenticates it from the httpOnly auth cookie sent with the handshake.
export function SocketProvider({ children }) {
  const { user } = useAuth();
  const [socket, setSocket] = useState(null);
  const userId = user?.id;

  useEffect(() => {
    if (!userId) return undefined;

    const instance = io(API_URL || undefined, { withCredentials: true });
    setSocket(instance);

    return () => {
      instance.disconnect();
      setSocket(null);
    };
  }, [userId]);

  return <SocketContext.Provider value={socket}>{children}</SocketContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useSocket() {
  return useContext(SocketContext);
}

// Subscribe to a socket event for the lifetime of the calling component.
// eslint-disable-next-line react-refresh/only-export-components
export function useSocketEvent(event, handler) {
  const socket = useSocket();
  useEffect(() => {
    if (!socket) return undefined;
    socket.on(event, handler);
    return () => socket.off(event, handler);
  }, [socket, event, handler]);
}
