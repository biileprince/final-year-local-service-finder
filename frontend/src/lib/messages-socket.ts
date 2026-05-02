import { useEffect, useState, useCallback, useRef } from "react";
import { io, Socket } from "socket.io-client";
import { useAuth } from "@/hooks";
import type { Message } from "@/types";

const SOCKET_URL = process.env.NEXT_PUBLIC_WS_URL || "http://localhost:3001";

interface UseMessagesSocketReturn {
  socket: Socket | null;
  isConnected: boolean;
  joinConversation: (conversationId: string) => void;
  leaveConversation: (conversationId: string) => void;
  sendMessage: (conversationId: string, content: string) => void;
  onNewMessage: (callback: (message: Message) => void) => () => void;
  onTyping: (
    callback: (data: { conversationId: string; userId: string }) => void,
  ) => () => void;
  startTyping: (conversationId: string) => void;
  stopTyping: (conversationId: string) => void;
}

export function useMessagesSocket(): UseMessagesSocketReturn {
  const { user, token } = useAuth();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const messageCallbacksRef = useRef<Set<(message: Message) => void>>(
    new Set(),
  );
  const typingCallbacksRef = useRef<
    Set<(data: { conversationId: string; userId: string }) => void>
  >(new Set());

  useEffect(() => {
    if (!user || !token) {
      return;
    }

    const socketInstance = io(SOCKET_URL, {
      auth: {
        token,
      },
      transports: ["websocket", "polling"],
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    socketInstance.on("connect", () => {
      console.log("Socket connected");
      setIsConnected(true);
    });

    socketInstance.on("disconnect", () => {
      console.log("Socket disconnected");
      setIsConnected(false);
    });

    socketInstance.on("connect_error", (error) => {
      console.error("Socket connection error:", error);
      setIsConnected(false);
    });

    socketInstance.on("newMessage", (message: Message) => {
      messageCallbacksRef.current.forEach((callback) => callback(message));
    });

    socketInstance.on(
      "userTyping",
      (data: { conversationId: string; userId: string }) => {
        typingCallbacksRef.current.forEach((callback) => callback(data));
      },
    );

    setSocket(socketInstance);

    return () => {
      socketInstance.disconnect();
      setSocket(null);
      setIsConnected(false);
    };
  }, [user, token]);

  const joinConversation = useCallback(
    (conversationId: string) => {
      if (socket && isConnected) {
        socket.emit("joinConversation", { conversationId });
      }
    },
    [socket, isConnected],
  );

  const leaveConversation = useCallback(
    (conversationId: string) => {
      if (socket && isConnected) {
        socket.emit("leaveConversation", { conversationId });
      }
    },
    [socket, isConnected],
  );

  const sendMessage = useCallback(
    (conversationId: string, content: string) => {
      if (socket && isConnected) {
        socket.emit("sendMessage", { conversationId, content });
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

  const onTyping = useCallback(
    (callback: (data: { conversationId: string; userId: string }) => void) => {
      typingCallbacksRef.current.add(callback);
      return () => {
        typingCallbacksRef.current.delete(callback);
      };
    },
    [],
  );

  const startTyping = useCallback(
    (conversationId: string) => {
      if (socket && isConnected) {
        socket.emit("typing", { conversationId, isTyping: true });
      }
    },
    [socket, isConnected],
  );

  const stopTyping = useCallback(
    (conversationId: string) => {
      if (socket && isConnected) {
        socket.emit("typing", { conversationId, isTyping: false });
      }
    },
    [socket, isConnected],
  );

  return {
    socket,
    isConnected,
    joinConversation,
    leaveConversation,
    sendMessage,
    onNewMessage,
    onTyping,
    startTyping,
    stopTyping,
  };
}
