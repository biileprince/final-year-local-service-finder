"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, Check, CheckCheck, Trash2, Settings, ChevronRight } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/spinner";
import { notificationsService } from "@/lib/api";
import { useNotificationsSocket } from "@/lib/notifications-socket";
import type { Notification } from "@/types";
import { formatRelativeTime, cn } from "@/lib/utils";

// Keys match the backend `referenceType` values (NotificationCategory enum,
// stored lowercase). Older uppercase keys never matched, so every icon fell
// back to the generic envelope.
const notificationIcons: Record<string, string> = {
  booking_confirmed: "✅",
  booking_cancelled: "❌",
  booking_reminder: "⏰",
  booking_completed: "🎉",
  new_message: "💬",
  new_review: "⭐",
  review_response: "💬",
  provider_verified: "🛡️",
  provider_suspended: "⚠️",
  system: "📢",
};

/**
 * Resolve the in-app destination for a notification from its category +
 * referenceId. Returns null when there's no meaningful page to open (the row
 * is still clickable to mark it read). Booking/message types deep-link; review
 * and provider-status types have no dedicated detail page yet.
 */
function notificationHref(n: Notification): string | null {
  const id = n.referenceId;
  switch (n.referenceType) {
    case "booking_confirmed":
    case "booking_cancelled":
    case "booking_reminder":
    case "booking_completed":
      return id ? `/bookings/${id}` : "/bookings";
    case "new_message":
      return id ? `/messages/${id}` : "/messages";
    case "provider_verified":
    case "provider_suspended":
      return "/services";
    default:
      return null;
  }
}

export default function NotificationsPage() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const { onNewNotification, markRead, markAllRead } = useNotificationsSocket();

  useEffect(() => {
    loadNotifications();
  }, []);

  useEffect(() => {
    return onNewNotification((n) => {
      setNotifications((prev) =>
        prev.some((existing) => existing.id === n.id) ? prev : [n, ...prev],
      );
    });
  }, [onNewNotification]);

  const loadNotifications = async () => {
    setIsLoading(true);
    try {
      const data = await notificationsService.getAll();
      setNotifications(data);
    } catch (error) {
      console.error("Failed to load notifications:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleMarkAsRead = async (id: string) => {
    try {
      await notificationsService.markAsRead(id);
      setNotifications((prev) =>
        prev.map((n) =>
          n.id === id
            ? { ...n, isRead: true, readAt: new Date().toISOString() }
            : n,
        ),
      );
      markRead(id);
    } catch (error) {
      console.error("Failed to mark as read:", error);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await notificationsService.markAllAsRead();
      setNotifications((prev) =>
        prev.map((n) => ({
          ...n,
          isRead: true,
          readAt: new Date().toISOString(),
        })),
      );
      markAllRead();
    } catch (error) {
      console.error("Failed to mark all as read:", error);
    }
  };

  const handleOpen = (notification: Notification) => {
    if (!notification.isRead) void handleMarkAsRead(notification.id);
    const href = notificationHref(notification);
    if (href) router.push(href);
  };

  const handleDelete = async (id: string) => {
    try {
      await notificationsService.delete(id);
      setNotifications((prev) => prev.filter((n) => n.id !== id));
    } catch (error) {
      console.error("Failed to delete notification:", error);
    }
  };

  const filteredNotifications =
    filter === "unread"
      ? notifications.filter((n) => !n.isRead)
      : notifications;

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-2">
            <Skeleton className="h-7 w-40" />
            <Skeleton className="h-4 w-56" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-10 w-32 rounded-lg" />
            <Skeleton className="h-10 w-36 rounded-lg" />
          </div>
        </div>
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="flex items-start gap-4 p-4">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-1/2" />
                  <Skeleton className="h-3 w-5/6" />
                  <Skeleton className="h-3 w-20" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-secondary-900">
            Notifications
          </h1>
          <p className="mt-1 text-secondary-600">
            Stay updated on your bookings and messages
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href="/settings">
              <Settings className="mr-2 h-4 w-4" />
              Preferences
            </Link>
          </Button>
          {unreadCount > 0 && (
            <Button variant="outline" onClick={handleMarkAllAsRead}>
              <CheckCheck className="mr-2 h-4 w-4" />
              Mark All Read
            </Button>
          )}
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2">
        <button
          onClick={() => setFilter("all")}
          className={cn(
            "rounded-lg px-4 py-2 text-sm font-medium transition-colors",
            filter === "all"
              ? "bg-primary-600 text-white"
              : "bg-secondary-100 text-secondary-600 hover:bg-secondary-200",
          )}
        >
          All
        </button>
        <button
          onClick={() => setFilter("unread")}
          className={cn(
            "rounded-lg px-4 py-2 text-sm font-medium transition-colors",
            filter === "unread"
              ? "bg-primary-600 text-white"
              : "bg-secondary-100 text-secondary-600 hover:bg-secondary-200",
          )}
        >
          Unread
          {unreadCount > 0 && (
            <span className="ml-2 rounded-full bg-primary-100 px-2 py-0.5 text-xs text-primary-700">
              {unreadCount}
            </span>
          )}
        </button>
      </div>

      {/* Notifications List */}
      {filteredNotifications.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Bell className="mx-auto h-16 w-16 text-secondary-300" />
            <h3 className="mt-4 text-lg font-medium text-secondary-900">
              {filter === "unread"
                ? "No unread notifications"
                : "No notifications yet"}
            </h3>
            <p className="mt-2 text-secondary-500">
              {filter === "unread"
                ? "You're all caught up!"
                : "You'll receive notifications about your bookings and messages here"}
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="divide-y divide-secondary-100 p-0">
            {filteredNotifications.map((notification) => {
              const href = notificationHref(notification);
              const clickable = href !== null;
              return (
                <div
                  key={notification.id}
                  role={clickable ? "button" : undefined}
                  tabIndex={clickable ? 0 : undefined}
                  onClick={clickable ? () => handleOpen(notification) : undefined}
                  onKeyDown={
                    clickable
                      ? (e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            handleOpen(notification);
                          }
                        }
                      : undefined
                  }
                  className={cn(
                    "flex items-start gap-4 p-4 transition-colors",
                    !notification.isRead && "bg-primary-50/50",
                    clickable &&
                      "cursor-pointer hover:bg-secondary-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-500",
                  )}
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-secondary-100 text-xl">
                    {notificationIcons[notification.referenceType || ""] || "📬"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h4
                          className={cn(
                            "text-secondary-900",
                            !notification.isRead && "font-semibold",
                          )}
                        >
                          {notification.title}
                        </h4>
                        <p className="mt-1 text-sm text-secondary-600">
                          {notification.body}
                        </p>
                        <p className="mt-2 flex items-center gap-1 text-xs text-secondary-500">
                          {formatRelativeTime(notification.createdAt)}
                          {clickable && (
                            <span className="inline-flex items-center font-medium text-primary-600">
                              · View
                              <ChevronRight className="h-3 w-3" />
                            </span>
                          )}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {!notification.isRead && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleMarkAsRead(notification.id);
                            }}
                            className="rounded p-1 text-secondary-400 hover:bg-secondary-100 hover:text-secondary-600"
                            title="Mark as read"
                          >
                            <Check className="h-4 w-4" />
                          </button>
                        )}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(notification.id);
                          }}
                          className="rounded p-1 text-secondary-400 hover:bg-error-50 hover:text-error-600"
                          title="Delete"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                  {!notification.isRead && (
                    <div className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary-600" />
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
