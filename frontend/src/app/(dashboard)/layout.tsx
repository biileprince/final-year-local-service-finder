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
  BarChart3,
  Wrench,
  ShieldCheck,
  Users,
  Star,
  Folder,
  History,
  MailWarning,
  Heart,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Loading } from "@/components/ui/spinner";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { useRequireAuth } from "@/hooks";
import { notificationsService, messagesService } from "@/lib/api";
import { useMessagesSocket } from "@/lib/messages-socket";
import { useNotificationsSocket } from "@/lib/notifications-socket";
import { useToast } from "@/components/ui/toast";

const customerNavItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/bookings", label: "My Bookings", icon: Calendar },
  { href: "/favorites", label: "Favorites", icon: Heart },
  { href: "/messages", label: "Messages", icon: MessageSquare },
  { href: "/notifications", label: "Notifications", icon: Bell },
  { href: "/profile", label: "Profile", icon: User },
  { href: "/settings", label: "Settings", icon: Settings },
];

const adminNavItems = [
  { href: "/admin", label: "Admin Home", icon: LayoutDashboard },
  { href: "/admin/providers", label: "Verification", icon: ShieldCheck },
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/bookings", label: "Bookings", icon: Calendar },
  { href: "/admin/reviews", label: "Reviews", icon: Star },
  { href: "/admin/categories", label: "Categories", icon: Folder },
  { href: "/admin/audit-logs", label: "Audit", icon: History },
  { href: "/messages", label: "Messages", icon: MessageSquare },
  { href: "/notifications", label: "Notifications", icon: Bell },
  { href: "/settings", label: "Settings", icon: Settings },
];

const providerNavItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/bookings", label: "Bookings", icon: Calendar },
  { href: "/availability", label: "Availability", icon: Briefcase },
  { href: "/services", label: "My Services", icon: Wrench },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/messages", label: "Messages", icon: MessageSquare },
  { href: "/notifications", label: "Notifications", icon: Bell },
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
  const [showVerifyBanner, setShowVerifyBanner] = useState(true);

  const navItems =
    user?.role === "ADMIN"
      ? adminNavItems
      : user?.role === "PROVIDER"
        ? providerNavItems
        : customerNavItems;

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
    // Refresh counts every 30 s while the tab is open
    const interval = setInterval(loadCounts, 30_000);

    // Also refresh when the user returns to the tab — the polling interval
    // alone leaves the badge stale for up to 30 s after focus.
    const onVisibility = () => {
      if (document.visibilityState === "visible") loadCounts();
    };
    const onFocus = () => loadCounts();
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("focus", onFocus);

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("focus", onFocus);
    };
  }, [loadCounts]);

  // Clear message badge when visiting messages
  useEffect(() => {
    if (pathname.startsWith("/messages")) setUnreadMessages(0);
    if (pathname === "/notifications") setUnreadNotifications(0);
  }, [pathname]);

  // Live-update message badge when a socket message arrives in another thread
  const { onNewMessage } = useMessagesSocket();
  useEffect(() => {
    const unsubscribe = onNewMessage((msg) => {
      if (msg.senderId === user?.id) return;
      if (pathname.startsWith("/messages")) return;
      setUnreadMessages((n) => n + 1);
    });
    return unsubscribe;
  }, [onNewMessage, pathname, user?.id]);

  // In-app push: surface each new notification as a toast while the user is
  // anywhere in the dashboard. Skip when they're already on /notifications —
  // a toast over the same list would just be noise.
  const { onNewNotification } = useNotificationsSocket();
  const { toast } = useToast();
  useEffect(() => {
    const unsubscribe = onNewNotification((n) => {
      setUnreadNotifications((c) => c + 1);
      if (pathname === "/notifications") return;
      toast({
        variant: "info",
        title: n.title,
        description: n.body,
        // Slightly longer than the default — these arrive without warning so
        // give the user time to read past the title.
        duration: 6000,
      });
    });
    return unsubscribe;
  }, [onNewNotification, pathname, toast]);

  if (isLoading) {
    return <Loading fullScreen text="Loading your dashboard..." />;
  }

  if (!isAuthenticated || !user) {
    return <Loading fullScreen text="Redirecting..." />;
  }

  return (
    <div className="min-h-screen bg-secondary-50">
      <a
        href="#dashboard-main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-primary-600 focus:px-4 focus:py-2 focus:text-sm focus:font-bold focus:text-white focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-primary-300"
      >
        Skip to main content
      </a>
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
              type="button"
              onClick={() => setSidebarOpen(false)}
              className="rounded-lg p-1 hover:bg-secondary-100 lg:hidden"
              aria-label="Close navigation"
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
              const isActive =
                pathname === item.href || pathname.startsWith(`${item.href}/`);
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
            type="button"
            onClick={() => setSidebarOpen(true)}
            className="rounded-lg p-2 hover:bg-secondary-100 lg:hidden"
            aria-label="Open navigation"
          >
            <Menu className="h-5 w-5" />
          </button>

          <div className="flex items-center gap-2 sm:gap-3">
            <ThemeToggle className="p-2" />

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

        {/* Email verification banner */}
        {!user.emailVerifiedAt && showVerifyBanner && (
          <div className="mx-4 mt-3 flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm sm:mx-6 lg:mx-8">
            <MailWarning className="h-5 w-5 shrink-0 text-amber-600" />
            <p className="flex-1 text-amber-800">
              <strong>Verify your email</strong> to unlock bookings and messaging.
            </p>
            <Link
              href="/verify-email"
              className="shrink-0 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-amber-700"
            >
              Enter code
            </Link>
            <button
              onClick={() => setShowVerifyBanner(false)}
              className="shrink-0 text-amber-400 hover:text-amber-600"
              aria-label="Dismiss"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Page Content */}
        <main id="dashboard-main" className="p-4 pb-24 sm:p-6 lg:p-8 lg:pb-8">
          {children}
        </main>
      </div>

      {/* Mobile bottom navigation */}
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t bg-white shadow-[0_-2px_8px_rgba(0,0,0,0.04)] lg:hidden">
        <ul className="grid grid-cols-5">
          {navItems.slice(0, 5).map((item) => {
            const isActive =
              pathname === item.href || pathname.startsWith(`${item.href}/`);
            const badgeCount =
              item.href === "/messages"
                ? unreadMessages
                : item.href === "/notifications"
                  ? unreadNotifications
                  : 0;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    "relative flex flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-semibold transition-colors",
                    isActive
                      ? "text-primary-600"
                      : "text-secondary-500 hover:text-secondary-900",
                  )}
                >
                  <item.icon className="h-5 w-5" />
                  <span className="leading-none">{item.label}</span>
                  {badgeCount > 0 && (
                    <span className="absolute right-3 top-1.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-primary-600 px-0.5 text-[10px] font-bold text-white">
                      {badgeCount > 99 ? "99+" : badgeCount}
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
