"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { MessageSquare, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { Spinner } from "@/components/ui/spinner";
import { useAuth } from "@/hooks";
import { messagesService } from "@/lib/api";
import { useMessagesSocket } from "@/lib/messages-socket";
import type { Conversation } from "@/types";
import { cn, formatRelativeTime } from "@/lib/utils";

export default function MessagesPage() {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  const { onNewMessage } = useMessagesSocket();

  const loadConversations = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await messagesService.getConversations();
      setConversations(data);
    } catch {
      // ignore
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  // When a new message arrives, bump that conversation to the top and update its preview
  useEffect(() => {
    const unsubscribe = onNewMessage((msg) => {
      setConversations((prev) => {
        const idx = prev.findIndex((c) => c.id === msg.conversationId);
        const base = idx >= 0 ? prev[idx] : undefined;
        if (!base) {
          loadConversations();
          return prev;
        }
        const isProvider = user?.role === "PROVIDER";
        const notSelf = msg.senderId !== user?.id;
        const updated: Conversation = {
          ...base,
          lastMessageAt: msg.createdAt,
          lastMessagePreview: msg.content,
          providerUnreadCount: notSelf && isProvider
            ? base.providerUnreadCount + 1
            : base.providerUnreadCount,
          customerUnreadCount: notSelf && !isProvider
            ? base.customerUnreadCount + 1
            : base.customerUnreadCount,
        };
        const rest = prev.filter((_, i) => i !== idx);
        return [updated, ...rest];
      });
    });
    return unsubscribe;
  }, [onNewMessage, user, loadConversations]);

  const filteredConversations = conversations.filter((conv) => {
    if (!searchQuery) return true;
    const otherUser =
      user?.role === "PROVIDER" ? conv.customer : conv.provider?.user;
    return otherUser?.name.toLowerCase().includes(searchQuery.toLowerCase());
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-secondary-900">Messages</h1>
        <p className="mt-1 text-secondary-600">
          Communicate with your{" "}
          {user?.role === "PROVIDER" ? "customers" : "service providers"}
        </p>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-secondary-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search conversations..."
          className="h-11 w-full rounded-lg border border-secondary-300 bg-white pl-10 pr-4 text-secondary-900 placeholder:text-secondary-400 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
        />
      </div>

      {filteredConversations.length === 0 ? (
        <div className="rounded-xl bg-white p-16 text-center shadow-soft">
          <MessageSquare className="mx-auto h-16 w-16 text-secondary-300" />
          <h3 className="mt-4 text-lg font-medium text-secondary-900">
            {searchQuery ? "No conversations found" : "No messages yet"}
          </h3>
          <p className="mt-2 text-secondary-500">
            {searchQuery
              ? "Try a different search term"
              : "Start a conversation by booking a service"}
          </p>
          {!searchQuery && user?.role === "CUSTOMER" && (
            <Button asChild className="mt-6">
              <Link href="/search">Find Service Providers</Link>
            </Button>
          )}
        </div>
      ) : (
        <div className="divide-y divide-secondary-100 overflow-hidden rounded-xl bg-white shadow-soft">
          {filteredConversations.map((conversation) => (
            <ConversationItem
              key={conversation.id}
              conversation={conversation}
              currentUserRole={user?.role}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ConversationItem({
  conversation,
  currentUserRole,
}: {
  conversation: Conversation;
  currentUserRole?: string;
}) {
  const otherUser =
    currentUserRole === "PROVIDER"
      ? conversation.customer
      : conversation.provider?.user;

  const unreadCount =
    currentUserRole === "PROVIDER"
      ? conversation.providerUnreadCount
      : conversation.customerUnreadCount;

  return (
    <Link
      href={`/messages/${conversation.id}`}
      className="flex items-center gap-4 p-4 transition-colors hover:bg-secondary-50"
    >
      <div className="relative">
        <Avatar
          size="lg"
          src={otherUser?.profileImage}
          name={otherUser?.name}
        />
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary-600 text-xs font-medium text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </div>

      <div className="flex-1 overflow-hidden">
        <div className="flex items-center justify-between">
          <h3
            className={cn(
              "font-medium",
              unreadCount > 0 ? "text-secondary-900" : "text-secondary-700",
            )}
          >
            {otherUser?.name}
          </h3>
          {conversation.lastMessageAt && (
            <span className="text-xs text-secondary-500">
              {formatRelativeTime(conversation.lastMessageAt)}
            </span>
          )}
        </div>
        <p
          className={cn(
            "mt-1 truncate text-sm",
            unreadCount > 0
              ? "font-medium text-secondary-900"
              : "text-secondary-500",
          )}
        >
          {conversation.lastMessagePreview || "No messages yet"}
        </p>
      </div>
    </Link>
  );
}
