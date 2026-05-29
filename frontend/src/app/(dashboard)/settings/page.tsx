"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Bell,
  Moon,
  Sun,
  Globe,
  Shield,
  Smartphone,
  ChevronRight,
  CalendarDays,
  Copy,
  Download,
  Trash2,
  Monitor,
  LogOut,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { bookingsService, usersService, authService } from "@/lib/api";
import type { SessionInfo } from "@/lib/api";
import { useAuth } from "@/hooks/use-auth";
import { formatRelativeTime } from "@/lib/utils";

export default function SettingsPage() {
  const router = useRouter();
  const { logout } = useAuth();
  const [theme, setTheme] = useState<"light" | "dark" | "system">("system");
  const [language, setLanguage] = useState("en");
  const [feedUrl, setFeedUrl] = useState<string | null>(null);
  const [feedLoading, setFeedLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const exportData = async () => {
    setExporting(true);
    setExportError(null);
    try {
      const data = await usersService.exportData();
      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `my-data-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setExportError(
        err instanceof Error ? err.message : "Failed to export your data",
      );
    } finally {
      setExporting(false);
    }
  };

  const deleteAccount = async () => {
    setDeleting(true);
    setDeleteError(null);
    try {
      await usersService.deleteAccount();
      await logout();
      router.replace("/");
    } catch (err) {
      setDeleteError(
        err instanceof Error ? err.message : "Failed to delete your account",
      );
      setDeleting(false);
    }
  };

  // --- Active sessions ---
  const [sessions, setSessions] = useState<SessionInfo[] | null>(null);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [revokingOthers, setRevokingOthers] = useState(false);

  const loadSessions = useCallback(async () => {
    setSessionsLoading(true);
    try {
      setSessions(await authService.listSessions());
    } catch {
      setSessions([]);
    } finally {
      setSessionsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSessions();
  }, [loadSessions]);

  const revokeSession = async (id: string) => {
    setRevokingId(id);
    try {
      await authService.revokeSession(id);
      setSessions((prev) => prev?.filter((s) => s.id !== id) ?? null);
    } catch {
      /* surfaced via reload below */
    } finally {
      setRevokingId(null);
    }
  };

  const revokeOthers = async () => {
    setRevokingOthers(true);
    try {
      await authService.revokeOtherSessions();
      setSessions((prev) => prev?.filter((s) => s.current) ?? null);
    } catch {
      /* no-op */
    } finally {
      setRevokingOthers(false);
    }
  };

  const loadFeed = async () => {
    setFeedLoading(true);
    try {
      const { url } = await bookingsService.getCalendarFeed();
      setFeedUrl(url);
    } catch (err) {
      console.error("Failed to load calendar feed:", err);
    } finally {
      setFeedLoading(false);
    }
  };

  const resetFeed = async () => {
    if (
      !confirm(
        "Reset the link? Calendars subscribed to the old URL will stop updating.",
      )
    )
      return;
    setFeedLoading(true);
    try {
      const { url } = await bookingsService.resetCalendarFeed();
      setFeedUrl(url);
    } catch (err) {
      console.error("Failed to reset calendar feed:", err);
    } finally {
      setFeedLoading(false);
    }
  };

  const copyFeed = () => {
    if (!feedUrl) return;
    navigator.clipboard.writeText(feedUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };



  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-secondary-900">Settings</h1>
        <p className="mt-1 text-secondary-600">
          Manage your account preferences and notifications
        </p>
      </div>

      {/* Notification Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Notifications
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Link
            href="/settings/notifications"
            className="flex items-center justify-between rounded-lg border border-secondary-200 p-4 transition-colors hover:bg-secondary-50"
          >
            <div>
              <h3 className="font-medium text-secondary-900">
                Notification Preferences
              </h3>
              <p className="text-sm text-secondary-500">
                Manage email, SMS, and push notification settings per event type
              </p>
            </div>
            <ChevronRight className="h-5 w-5 shrink-0 text-secondary-400" />
          </Link>
        </CardContent>
      </Card>

      {/* Appearance */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sun className="h-5 w-5" />
            Appearance
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div>
            <h3 className="mb-3 text-sm font-medium text-secondary-900">
              Theme
            </h3>
            <div className="flex gap-3">
              <ThemeButton
                icon={<Sun className="h-5 w-5" />}
                label="Light"
                active={theme === "light"}
                onClick={() => setTheme("light")}
              />
              <ThemeButton
                icon={<Moon className="h-5 w-5" />}
                label="Dark"
                active={theme === "dark"}
                onClick={() => setTheme("dark")}
              />
              <ThemeButton
                icon={<Smartphone className="h-5 w-5" />}
                label="System"
                active={theme === "system"}
                onClick={() => setTheme("system")}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Language */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            Language & Region
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div>
            <label className="mb-2 block text-sm font-medium text-secondary-700">
              Language
            </label>
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="w-full max-w-xs rounded-lg border border-secondary-300 bg-white px-3 py-2 text-secondary-900 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
            >
              <option value="en">English</option>
              <option value="fr">French</option>
              <option value="tw">Twi</option>
              <option value="ga">Ga</option>
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Privacy & Security */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Privacy & Security
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border border-secondary-200 p-4">
            <div>
              <h3 className="font-medium text-secondary-900">
                Two-Factor Authentication
              </h3>
              <p className="text-sm text-secondary-500">
                Add an extra layer of security to your account
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                alert(
                  "2FA setup is coming soon. You will be able to use an authenticator app.",
                )
              }
            >
              Enable
            </Button>
          </div>

          <div className="rounded-lg border border-secondary-200 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="font-medium text-secondary-900">
                  Active Sessions
                </h3>
                <p className="text-sm text-secondary-500">
                  Devices currently signed in to your account
                </p>
              </div>
              {sessions && sessions.some((s) => !s.current) && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={revokeOthers}
                  isLoading={revokingOthers}
                >
                  <LogOut className="mr-1.5 h-4 w-4" />
                  Sign out others
                </Button>
              )}
            </div>

            <div className="mt-4 space-y-2">
              {sessionsLoading ? (
                <p className="text-sm text-secondary-500">Loading sessions…</p>
              ) : !sessions || sessions.length === 0 ? (
                <p className="text-sm text-secondary-500">
                  No active sessions found.
                </p>
              ) : (
                sessions.map((s) => (
                  <div
                    key={s.id}
                    className="flex items-center justify-between gap-3 rounded-lg bg-secondary-50 px-3 py-2.5"
                  >
                    <div className="flex items-center gap-3 overflow-hidden">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-secondary-600">
                        {isMobileAgent(s.userAgent) ? (
                          <Smartphone className="h-4 w-4" />
                        ) : (
                          <Monitor className="h-4 w-4" />
                        )}
                      </div>
                      <div className="overflow-hidden">
                        <p className="truncate text-sm font-medium text-secondary-900">
                          {describeAgent(s.userAgent)}
                          {s.current && (
                            <span className="ml-2 rounded-full bg-success-50 px-2 py-0.5 text-xs font-medium text-success-700">
                              This device
                            </span>
                          )}
                        </p>
                        <p className="truncate text-xs text-secondary-500">
                          {s.ipAddress ? `${s.ipAddress} · ` : ""}
                          Active {formatRelativeTime(s.lastActiveAt)}
                        </p>
                      </div>
                    </div>
                    {!s.current && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="shrink-0 text-error-600 hover:bg-error-50"
                        onClick={() => revokeSession(s.id)}
                        isLoading={revokingId === s.id}
                      >
                        Revoke
                      </Button>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="flex items-center justify-between rounded-lg border border-secondary-200 p-4">
            <div>
              <h3 className="font-medium text-secondary-900">
                Download Your Data
              </h3>
              <p className="text-sm text-secondary-500">
                Get a machine-readable copy of all your data (profile, bookings,
                reviews, messages, and more)
              </p>
              {exportError && (
                <p className="mt-1 text-sm text-error-600">{exportError}</p>
              )}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={exportData}
              isLoading={exporting}
            >
              <Download className="mr-1.5 h-4 w-4" />
              Download
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Danger zone */}
      <Card className="border-error-500/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-error-700">
            <Trash2 className="h-5 w-5" />
            Delete account
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-secondary-600">
            Permanently delete your account and sign out of all devices. This
            cannot be undone. We recommend downloading your data first.
          </p>

          {!deleteOpen ? (
            <Button
              variant="outline"
              size="sm"
              className="border-error-500/40 text-error-700 hover:bg-error-50"
              onClick={() => setDeleteOpen(true)}
            >
              Delete my account
            </Button>
          ) : (
            <div className="space-y-3 rounded-lg border border-error-500/30 bg-error-50 p-4">
              <label
                htmlFor="delete-confirm"
                className="block text-sm font-medium text-secondary-900"
              >
                Type <span className="font-mono font-bold">DELETE</span> to
                confirm
              </label>
              <input
                id="delete-confirm"
                value={deleteConfirm}
                onChange={(e) => setDeleteConfirm(e.target.value)}
                className="w-full max-w-xs rounded-lg border border-secondary-300 px-3 py-2 text-secondary-900 focus:border-error-500 focus:outline-none focus:ring-2 focus:ring-error-500/20"
                placeholder="DELETE"
                autoComplete="off"
              />
              {deleteError && (
                <p className="text-sm text-error-600">{deleteError}</p>
              )}
              <div className="flex gap-3">
                <Button
                  size="sm"
                  className="bg-error-600 text-white hover:bg-error-700"
                  disabled={deleteConfirm !== "DELETE"}
                  isLoading={deleting}
                  onClick={deleteAccount}
                >
                  Permanently delete
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setDeleteOpen(false);
                    setDeleteConfirm("");
                    setDeleteError(null);
                  }}
                  disabled={deleting}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Calendar sync */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5" />
            Calendar sync
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-secondary-600">
            Subscribe to a private calendar feed to see your bookings in Google
            Calendar, Apple Calendar, or Outlook. The link updates automatically
            as bookings change.
          </p>

          {!feedUrl ? (
            <Button variant="outline" onClick={loadFeed} isLoading={feedLoading}>
              Generate subscription link
            </Button>
          ) : (
            <div className="space-y-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <input
                  readOnly
                  value={feedUrl}
                  onFocus={(e) => e.currentTarget.select()}
                  className="w-full rounded-lg border-2 border-gray-200 px-3 py-2 text-sm text-secondary-700 focus:border-primary-500 focus:outline-none"
                />
                <Button variant="outline" size="sm" onClick={copyFeed}>
                  <Copy className="mr-1.5 h-4 w-4" />
                  {copied ? "Copied" : "Copy"}
                </Button>
              </div>
              <p className="text-xs text-secondary-500">
                Paste this into your calendar app&apos;s &quot;subscribe by
                URL&quot; option. Keep it private — anyone with the link can see
                your bookings.
              </p>
              <Button
                variant="ghost"
                size="sm"
                onClick={resetFeed}
                isLoading={feedLoading}
                className="text-error-600"
              >
                Reset link
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function isMobileAgent(ua: string | null): boolean {
  if (!ua) return false;
  return /mobile|android|iphone|ipad|ipod/i.test(ua);
}

// Best-effort "Browser on OS" label from a user-agent string.
function describeAgent(ua: string | null): string {
  if (!ua) return "Unknown device";
  const browser = /edg/i.test(ua)
    ? "Edge"
    : /chrome|crios/i.test(ua)
      ? "Chrome"
      : /firefox|fxios/i.test(ua)
        ? "Firefox"
        : /safari/i.test(ua)
          ? "Safari"
          : "Browser";
  const os = /windows/i.test(ua)
    ? "Windows"
    : /android/i.test(ua)
      ? "Android"
      : /iphone|ipad|ipod/i.test(ua)
        ? "iOS"
        : /mac os/i.test(ua)
          ? "macOS"
          : /linux/i.test(ua)
            ? "Linux"
            : "";
  return os ? `${browser} on ${os}` : browser;
}

function ThemeButton({
  icon,
  label,
  active,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center gap-2 rounded-lg border-2 px-6 py-4 transition-colors ${
        active
          ? "border-primary-600 bg-primary-50 text-primary-700"
          : "border-secondary-200 text-secondary-600 hover:border-secondary-300"
      }`}
    >
      {icon}
      <span className="text-sm font-medium">{label}</span>
    </button>
  );
}
