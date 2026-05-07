import { useEffect, useState, useCallback, useRef } from "react";
import { io, Socket } from "socket.io-client";
import { useAuth } from "@/hooks";
import type { Message } from "@/types";

const SOCKET_URL = process.env.NEXT_PUBLIC_WS_URL || "http://localhost:3001";

export interface ReadReceipt {
  conversationId: string;
  readBy: string;
  readAt: string;
}

export interface TypingPayload {
  conversationId: string;
  userId: string;
  isTyping: boolean;
}

interface UseMessagesSocketReturn {
  socket: Socket | null;
  isConnected: boolean;
  joinConversation: (conversationId: string) => void;
  leaveConversation: (conversationId: string) => void;
  sendMessage: (
    conversationId: string,
    content: string,
    extras?: { messageType?: string; fileId?: string },
  ) => void;
  markRead: (conversationId: string) => void;
  startTyping: (conversationId: string) => void;
  stopTyping: (conversationId: string) => void;
  onNewMessage: (callback: (message: Message) => void) => () => void;
  onTyping: (callback: (data: TypingPayload) => void) => () => void;
  onMessagesRead: (callback: (data: ReadReceipt) => void) => () => void;
  onUnreadCount: (
    callback: (data: { total: number; asCustomer: number; asProvider: number }) => void,
  ) => () => void;
}

export function useMessagesSocket(): UseMessagesSocketReturn {
  const { user } = useAuth();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const messageCallbacksRef = useRef<Set<(message: Message) => void>>(new Set());
  const typingCallbacksRef = useRef<Set<(data: TypingPayload) => void>>(new Set());
  const readCallbacksRef = useRef<Set<(data: ReadReceipt) => void>>(new Set());
  const unreadCallbacksRef = useRef<
    Set<(data: { total: number; asCustomer: number; asProvider: number }) => void>
  >(new Set());

  useEffect(() => {
    const token =
      typeof window !== "undefined"
        ? localStorage.getItem("accessToken")
        : null;
    if (!user || !token) {
      return;
    }

    // Backend mounts the gateway at the `/messages` namespace.
    const socketInstance = io(`${SOCKET_URL}/messages`, {
      auth: { token },
      transports: ["websocket", "polling"],
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    socketInstance.on("connect", () => setIsConnected(true));
    socketInstance.on("disconnect", () => setIsConnected(false));
    socketInstance.on("connect_error", () => setIsConnected(false));

    socketInstance.on("new_message", (message: Message) => {
      messageCallbacksRef.current.forEach((cb) => cb(message));
    });

    // Personal-room delivery for messages outside the active conversation room.
    socketInstance.on(
      "message_notification",
      (payload: { conversationId: string; message: Message }) => {
        messageCallbacksRef.current.forEach((cb) => cb(payload.message));
      },
    );

    socketInstance.on("user_typing", (data: TypingPayload) => {
      typingCallbacksRef.current.forEach((cb) => cb(data));
    });

    socketInstance.on("messages_read", (data: ReadReceipt) => {
      readCallbacksRef.current.forEach((cb) => cb(data));
    });

    socketInstance.on(
      "unread_count",
      (data: { total: number; asCustomer: number; asProvider: number }) => {
        unreadCallbacksRef.current.forEach((cb) => cb(data));
      },
    );

    setSocket(socketInstance);

    return () => {
      socketInstance.disconnect();
      setSocket(null);
      setIsConnected(false);
    };
  }, [user]);

  const joinConversation = useCallback(
    (conversationId: string) => {
      if (socket && isConnected) {
        socket.emit("join_conversation", { conversationId });
      }
    },
    [socket, isConnected],
  );

  const leaveConversation = useCallback(
    (conversationId: string) => {
      if (socket && isConnected) {
        socket.emit("leave_conversation", { conversationId });
      }
    },
    [socket, isConnected],
  );

  const sendMessage = useCallback(
    (
      conversationId: string,
      content: string,
      extras?: { messageType?: string; fileId?: string },
    ) => {
      if (socket && isConnected) {
        socket.emit("send_message", {
          conversationId,
          content,
          messageType: extras?.messageType,
          fileId: extras?.fileId,
        });
      }
    },
    [socket, isConnected],
  );

  const markRead = useCallback(
    (conversationId: string) => {
      if (socket && isConnected) {
        socket.emit("mark_read", { conversationId });
      }
    },
    [socket, isConnected],
  );

  const startTyping = useCallback(
    (conversationId: string) => {
      if (socket && isConnected) {
        socket.emit("typing_start", { conversationId });
      }
    },
    [socket, isConnected],
  );

  const stopTyping = useCallback(
    (conversationId: string) => {
      if (socket && isConnected) {
        socket.emit("typing_stop", { conversationId });
      }
    },
    [socket, isConnected],
  );

  const onNewMessage = useCallback((callback: (message: Message) => void) => {
    messageCallbacksRef.current.add(callback);
    return () => {
      messageCallbacksRef.current.delete(callback);
    };
  }, []);

  const onTyping = useCallback((callback: (data: TypingPayload) => void) => {
    typingCallbacksRef.current.add(callback);
    return () => {
      typingCallbacksRef.current.delete(callback);
    };
  }, []);

  const onMessagesRead = useCallback((callback: (data: ReadReceipt) => void) => {
    readCallbacksRef.current.add(callback);
    return () => {
      readCallbacksRef.current.delete(callback);
    };
  }, []);

  const onUnreadCount = useCallback(
    (
      callback: (data: {
        total: number;
        asCustomer: number;
        asProvider: number;
      }) => void,
    ) => {
      unreadCallbacksRef.current.add(callback);
      return () => {
        unreadCallbacksRef.current.delete(callback);
      };
    },
    [],
  );

  return {
    socket,
    isConnected,
    joinConversation,
    leaveConversation,
    sendMessage,
    markRead,
    startTyping,
    stopTyping,
    onNewMessage,
    onTyping,
    onMessagesRead,
    onUnreadCount,
  };
}
