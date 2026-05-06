"use client";

import { useEffect, useState, useRef } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ChevronLeft,
  Send,
  Paperclip,
  MoreVertical,
  Phone,
  Video,
  Calendar,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { Spinner } from "@/components/ui/spinner";
import { useAuth } from "@/hooks";
import { messagesService, filesService } from "@/lib/api";
import { useToast } from "@/components/ui/toast";
import { useMessagesSocket } from "@/lib/messages-socket";
import type { Conversation, Message } from "@/types";
import { formatRelativeTime, formatDate, formatTime, cn } from "@/lib/utils";

const statusBadge: Record<string, string> = {
  PENDING: "bg-warning-50 text-warning-700",
  CONFIRMED: "bg-primary-50 text-primary-700",
  IN_PROGRESS: "bg-primary-50 text-primary-700",
  COMPLETED: "bg-success-50 text-success-700",
  CANCELLED: "bg-error-50 text-error-700",
};

export default function ConversationPage() {
  const params = useParams();
  const { user } = useAuth();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [messageText, setMessageText] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleFileAttach = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !conversation) return;
    setUploadingFile(true);
    try {
      const uploaded = await filesService.upload(file, "MESSAGE");
      const newMessage = await messagesService.sendMessage(conversation.id, {
        content: file.name,
        messageType: "FILE",
        fileId: uploaded.id,
      });
      setMessages((prev) => [...prev, newMessage]);
    } catch (err) {
      toast({
        variant: "error",
        title: "Couldn't attach file",
        description: err instanceof Error ? err.message : "Try again.",
      });
    } finally {
      setUploadingFile(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const { socket, isConnected, joinConversation, sendMessage } =
    useMessagesSocket();

  useEffect(() => {
    if (params.id) {
      loadConversation(params.id as string);
    }
  }, [params.id]);

  useEffect(() => {
    if (conversation && socket && isConnected) {
      joinConversation(conversation.id);

      // Mark messages as read
      messagesService.markAsRead(conversation.id);
    }
  }, [conversation, socket, isConnected]);

  useEffect(() => {
    if (socket) {
      const handleNewMessage = (message: Message) => {
        if (message.conversationId === conversation?.id) {
          setMessages((prev) => [...prev, message]);
          scrollToBottom();
        }
      };

      socket.on("newMessage", handleNewMessage);

      return () => {
        socket.off("newMessage", handleNewMessage);
      };
    }
  }, [socket, conversation]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const loadConversation = async (id: string) => {
    setIsLoading(true);
    try {
      const [conversationData, messagesData] = await Promise.all([
        messagesService.getConversation(id),
        messagesService.getMessages(id),
      ]);
      setConversation(conversationData);
      setMessages(messagesData);
    } catch (error) {
      console.error("Failed to load conversation:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageText.trim() || !conversation) return;

    setIsSending(true);
    try {
      // Use socket if connected, fallback to REST API
      if (isConnected) {
        sendMessage(conversation.id, messageText.trim());
      } else {
        const newMessage = await messagesService.sendMessage(
          conversation.id,
          { content: messageText.trim() },
        );
        setMessages((prev) => [...prev, newMessage]);
      }
      setMessageText("");
    } catch (error) {
      console.error("Failed to send message:", error);
    } finally {
      setIsSending(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-[calc(100vh-12rem)] items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!conversation) {
    return (
      <div className="space-y-4 text-center">
        <h1 className="text-2xl font-bold text-secondary-900">
          Conversation not found
        </h1>
        <Button asChild>
          <Link href="/messages">Back to Messages</Link>
        </Button>
      </div>
    );
  }

  const otherUser =
    user?.role === "PROVIDER"
      ? conversation.customer
      : conversation.provider?.user;

  return (
    <div className="flex h-[calc(100vh-10rem)] flex-col rounded-xl bg-white shadow-soft">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-3">
          <Link
            href="/messages"
            className="rounded-lg p-1 hover:bg-secondary-100 lg:hidden"
          >
            <ChevronLeft className="h-5 w-5" />
          </Link>
          <Avatar src={otherUser?.profileImage} name={otherUser?.name} />
          <div>
            <h2 className="font-semibold text-secondary-900">
              {otherUser?.name}
            </h2>
            <p className="text-xs text-secondary-500">
              {isConnected ? (
                <span className="flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-success-500" />
                  Online
                </span>
              ) : (
                "Offline"
              )}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon">
            <Phone className="h-5 w-5" />
          </Button>
          <Button variant="ghost" size="icon">
            <Video className="h-5 w-5" />
          </Button>
          <Button variant="ghost" size="icon">
            <MoreVertical className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {/* Pinned booking summary */}
      {conversation.booking && (
        <Link
          href={`/bookings/${conversation.booking.id}`}
          className="flex items-center justify-between gap-3 border-b bg-secondary-50 px-4 py-2.5 text-sm transition-colors hover:bg-secondary-100"
        >
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-100 text-primary-700">
              <Calendar className="h-4 w-4" />
            </div>
            <div className="overflow-hidden">
              <p className="truncate font-medium text-secondary-900">
                Booking #{conversation.booking.bookingNumber}
              </p>
              <p className="truncate text-xs text-secondary-500">
                {conversation.booking.scheduledDate &&
                  formatDate(conversation.booking.scheduledDate)}
                {conversation.booking.scheduledStartTime &&
                  ` · ${formatTime(conversation.booking.scheduledStartTime)}`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-[11px] font-semibold",
                statusBadge[conversation.booking.status] ??
                  "bg-secondary-100 text-secondary-700",
              )}
            >
              {conversation.booking.status}
            </span>
            <ArrowRight className="h-4 w-4 text-secondary-400" />
          </div>
        </Link>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="space-y-4">
          {messages.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-secondary-500">
                No messages yet. Start the conversation!
              </p>
            </div>
          ) : (
            messages.map((message, index) => {
              const isOwn = message.senderId === user?.id;
              const showAvatar =
                !isOwn &&
                (index === 0 ||
                  messages[index - 1]?.senderId !== message.senderId);

              return (
                <div
                  key={message.id}
                  className={cn("flex gap-3", isOwn && "flex-row-reverse")}
                >
                  {showAvatar ? (
                    <Avatar
                      size="sm"
                      src={isOwn ? user?.profileImage : otherUser?.profileImage}
                      name={isOwn ? user?.name : otherUser?.name}
                    />
                  ) : (
                    <div className="w-8" />
                  )}
                  <div
                    className={cn(
                      "max-w-[70%] rounded-2xl px-4 py-2",
                      isOwn
                        ? "rounded-tr-sm bg-primary-600 text-white"
                        : "rounded-tl-sm bg-secondary-100 text-secondary-900",
                    )}
                  >
                    {message.file ? (
                      message.file.thumbnailUrl ||
                      /\.(png|jpe?g|gif|webp)$/i.test(message.file.fileName) ? (
                        <a
                          href={message.file.url}
                          target="_blank"
                          rel="noreferrer"
                          className="block"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={message.file.thumbnailUrl || message.file.url}
                            alt={message.file.fileName}
                            className="max-h-48 rounded-lg"
                          />
                        </a>
                      ) : (
                        <a
                          href={message.file.url}
                          target="_blank"
                          rel="noreferrer"
                          className={cn(
                            "inline-flex items-center gap-2 underline",
                            isOwn ? "text-white" : "text-primary-700",
                          )}
                        >
                          <Paperclip className="h-4 w-4" />
                          {message.file.fileName}
                        </a>
                      )
                    ) : (
                      <p className="text-sm">{message.content}</p>
                    )}
                    <p
                      className={cn(
                        "mt-1 text-xs",
                        isOwn ? "text-primary-200" : "text-secondary-400",
                      )}
                    >
                      {formatRelativeTime(message.createdAt)}
                    </p>
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input */}
      <form
        onSubmit={handleSendMessage}
        className="flex items-center gap-3 border-t px-4 py-3"
      >
        <input
          ref={fileInputRef}
          type="file"
          onChange={handleFileAttach}
          className="hidden"
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploadingFile}
          aria-label="Attach file"
        >
          <Paperclip className="h-5 w-5" />
        </Button>
        <input
          type="text"
          value={messageText}
          onChange={(e) => setMessageText(e.target.value)}
          placeholder="Type a message..."
          className="flex-1 rounded-full border border-secondary-300 bg-secondary-50 px-4 py-2 text-secondary-900 placeholder:text-secondary-400 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
        />
        <Button
          type="submit"
          size="icon"
          disabled={!messageText.trim() || isSending}
          className="rounded-full"
        >
          <Send className="h-5 w-5" />
        </Button>
      </form>
    </div>
  );
}
