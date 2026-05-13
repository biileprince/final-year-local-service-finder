import { useEffect, useState, useCallback, useRef } from "react";
import { io, Socket } from "socket.io-client";
import { useAuth } from "@/hooks";
import type { Notification } from "@/types";

const SOCKET_URL = process.env.NEXT_PUBLIC_WS_URL || "http://localhost:3001";

interface UseNotificationsSocketReturn {
  socket: Socket | null;
  isConnected: boolean;
  unreadCount: number;
  markRead: (id: string) => void;
  markAllRead: () => void;
  onNewNotification: (cb: (n: Notification) => void) => () => void;
}

export function useNotificationsSocket(): UseNotificationsSocketReturn {
  const { user } = useAuth();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const newNotificationCallbacksRef = useRef<Set<(n: Notification) => void>>(
    new Set(),
  );

  useEffect(() => {
    const token =
      typeof window !== "undefined"
        ? localStorage.getItem("accessToken")
        : null;
    if (!user || !token) return;

    const instance = io(`${SOCKET_URL}/notifications`, {
      auth: { token },
      transports: ["websocket", "polling"],
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    instance.on("connect", () => setIsConnected(true));
    instance.on("disconnect", () => setIsConnected(false));
    instance.on("connect_error", () => setIsConnected(false));

    instance.on("unread_count", (count: number) => {
      setUnreadCount(typeof count === "number" ? count : 0);
    });

    instance.on("new_notification", (n: Notification) => {
      newNotificationCallbacksRef.current.forEach((cb) => cb(n));
    });

    setSocket(instance);

    return () => {
      instance.disconnect();
      setSocket(null);
      setIsConnected(false);
    };
  }, [user]);

  const markRead = useCallback(
    (id: string) => {
      if (socket && isConnected) socket.emit("mark_read", { id });
    },
    [socket, isConnected],
  );

  const markAllRead = useCallback(() => {
    if (socket && isConnected) socket.emit("mark_all_read");
  }, [socket, isConnected]);

  const onNewNotification = useCallback((cb: (n: Notification) => void) => {
    newNotificationCallbacksRef.current.add(cb);
    return () => {
      newNotificationCallbacksRef.current.delete(cb);
    };
  }, []);

  return {
    socket,
    isConnected,
    unreadCount,
    markRead,
    markAllRead,
    onNewNotification,
  };
}
