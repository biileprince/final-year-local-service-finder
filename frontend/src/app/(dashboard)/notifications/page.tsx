"use client";

import { useEffect, useState } from "react";
import { Bell, Check, CheckCheck, Trash2, Settings } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { notificationsService } from "@/lib/api";
import type { Notification } from "@/types";
import { formatRelativeTime, cn } from "@/lib/utils";

const notificationIcons: Record<string, string> = {
  BOOKING_CREATED: "📅",
  BOOKING_CONFIRMED: "✅",
  BOOKING_CANCELLED: "❌",
  BOOKING_COMPLETED: "🎉",
  NEW_MESSAGE: "💬",
  NEW_REVIEW: "⭐",
  PAYMENT_RECEIVED: "💰",
  REMINDER: "⏰",
};

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "unread">("all");

  useEffect(() => {
    loadNotifications();
  }, []);

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
    } catch (error) {
      console.error("Failed to mark all as read:", error);
    }
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
      <div className="flex items-center justify-center py-20">
        <Spinner size="lg" />
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
            {filteredNotifications.map((notification) => (
              <div
                key={notification.id}
                className={cn(
                  "flex items-start gap-4 p-4 transition-colors",
                  !notification.isRead && "bg-primary-50/50",
                )}
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary-100 text-xl">
                  {notificationIcons[notification.referenceType || ""] || "📬"}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div>
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
                      <p className="mt-2 text-xs text-secondary-400">
                        {formatRelativeTime(notification.createdAt)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {!notification.isRead && (
                        <button
                          onClick={() => handleMarkAsRead(notification.id)}
                          className="rounded p-1 text-secondary-400 hover:bg-secondary-100 hover:text-secondary-600"
                          title="Mark as read"
                        >
                          <Check className="h-4 w-4" />
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(notification.id)}
                        className="rounded p-1 text-secondary-400 hover:bg-error-50 hover:text-error-600"
                        title="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
                {!notification.isRead && (
                  <div className="h-2 w-2 rounded-full bg-primary-600" />
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
