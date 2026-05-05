"use client";

import { useEffect, useCallback, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Calendar,
  MessageSquare,
  User,
  Settings,
  Bell,
  LogOut,
  Menu,
  X,
  Briefcase,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Loading } from "@/components/ui/spinner";
import { useRequireAuth } from "@/hooks";
import { notificationsService, messagesService } from "@/lib/api";

const customerNavItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/bookings", label: "My Bookings", icon: Calendar },
  { href: "/messages", label: "Messages", icon: MessageSquare },
  { href: "/notifications", label: "Notifications", icon: Bell },
  { href: "/profile", label: "Profile", icon: User },
  { href: "/settings", label: "Settings", icon: Settings },
];

const providerNavItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/bookings", label: "Bookings", icon: Calendar },
  { href: "/messages", label: "Messages", icon: MessageSquare },
  { href: "/notifications", label: "Notifications", icon: Bell },
  { href: "/availability", label: "Availability", icon: Briefcase },
  { href: "/profile", label: "Profile", icon: User },
  { href: "/settings", label: "Settings", icon: Settings },
];

function Badge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span className="ml-auto flex h-5 min-w-[20px] items-center justify-center rounded-full bg-primary-600 px-1 text-[11px] font-bold text-white">
      {count > 99 ? "99+" : count}
    </span>
  );
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { user, isLoading, isAuthenticated } = useRequireAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [unreadMessages, setUnreadMessages] = useState(0);

  const navItems =
    user?.role === "PROVIDER" ? providerNavItems : customerNavItems;

  const loadCounts = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      const [notifData, msgData] = await Promise.all([
        notificationsService.getUnreadCount(),
        messagesService.getUnreadCount(),
      ]);
      setUnreadNotifications(notifData.unreadCount ?? 0);
      setUnreadMessages(msgData.total ?? 0);
    } catch {
      // counts unavailable — not critical
    }
  }, [isAuthenticated]);

  useEffect(() => {
    loadCounts();
    // Refresh counts every 60 s while the tab is open
    const interval = setInterval(loadCounts, 60_000);
    return () => clearInterval(interval);
  }, [loadCounts]);

  // Clear message badge when visiting messages
  useEffect(() => {
    if (pathname.startsWith("/messages")) setUnreadMessages(0);
    if (pathname === "/notifications") setUnreadNotifications(0);
  }, [pathname]);

  if (isLoading) {
    return <Loading fullScreen text="Loading your dashboard..." />;
  }

  if (!isAuthenticated || !user) {
    return <Loading fullScreen text="Redirecting..." />;
  }

  return (
    <div className="min-h-screen bg-secondary-50">
      {/* Mobile Sidebar Backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-64 transform bg-white shadow-lg transition-transform duration-300 ease-in-out lg:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex h-full flex-col">
          {/* Logo */}
          <div className="flex h-16 items-center justify-between border-b px-6">
            <Link href="/" className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-600">
                <span className="text-lg font-bold text-white">L</span>
              </div>
              <span className="text-xl font-bold text-secondary-900">
                LocalService
              </span>
            </Link>
            <button
              onClick={() => setSidebarOpen(false)}
              className="rounded-lg p-1 hover:bg-secondary-100 lg:hidden"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* User Info */}
          <div className="border-b p-4">
            <div className="flex items-center gap-3">
              <Avatar size="lg" src={user.profileImage} name={user.name} />
              <div className="flex-1 overflow-hidden">
                <p className="truncate font-medium text-secondary-900">
                  {user.name}
                </p>
                <p className="truncate text-sm text-secondary-500">
                  {user.role === "PROVIDER" ? "Service Provider" : "Customer"}
                </p>
              </div>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 space-y-1 overflow-y-auto p-4">
            {navItems.map((item) => {
              const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
              const badgeCount =
                item.href === "/messages"
                  ? unreadMessages
                  : item.href === "/notifications"
                    ? unreadNotifications
                    : 0;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setSidebarOpen(false)}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-primary-50 text-primary-700"
                      : "text-secondary-600 hover:bg-secondary-100 hover:text-secondary-900",
                  )}
                >
                  <item.icon className="h-5 w-5 shrink-0" />
                  <span className="flex-1">{item.label}</span>
                  <Badge count={badgeCount} />
                </Link>
              );
            })}
          </nav>

          {/* Bottom Actions */}
          <div className="border-t p-4">
            <Link
              href="/logout"
              className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-secondary-600 transition-colors hover:bg-error-50 hover:text-error-600"
            >
              <LogOut className="h-5 w-5" />
              Logout
            </Link>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="lg:pl-64">
        {/* Top Header */}
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b bg-white px-4 sm:px-6">
          <button
            onClick={() => setSidebarOpen(true)}
            className="rounded-lg p-2 hover:bg-secondary-100 lg:hidden"
          >
            <Menu className="h-5 w-5" />
          </button>

          <div className="flex items-center gap-2 sm:gap-3">
            {/* Messages */}
            <Link
              href="/messages"
              className="relative rounded-lg p-2 text-secondary-600 transition-colors hover:bg-secondary-100 hover:text-secondary-900"
              aria-label="Messages"
            >
              <MessageSquare className="h-5 w-5" />
              {unreadMessages > 0 && (
                <span className="absolute right-1 top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-primary-600 px-0.5 text-[10px] font-bold text-white">
                  {unreadMessages > 99 ? "99+" : unreadMessages}
                </span>
              )}
            </Link>

            {/* Notifications */}
            <Link
              href="/notifications"
              className="relative rounded-lg p-2 text-secondary-600 transition-colors hover:bg-secondary-100 hover:text-secondary-900"
              aria-label="Notifications"
              onClick={() => setUnreadNotifications(0)}
            >
              <Bell className="h-5 w-5" />
              {unreadNotifications > 0 && (
                <span className="absolute right-1 top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-0.5 text-[10px] font-bold text-white">
                  {unreadNotifications > 99 ? "99+" : unreadNotifications}
                </span>
              )}
            </Link>
          </div>
        </header>

        {/* Page Content */}
        <main className="p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
