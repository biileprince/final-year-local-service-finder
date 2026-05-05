"use client";

import { useEffect, useState } from "react";
import {
  Bell,
  Moon,
  Sun,
  Globe,
  Shield,
  Smartphone,
  Mail,
  CheckCircle,
  AlertCircle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { notificationsService } from "@/lib/api";

interface NotificationPrefs {
  email: boolean;
  sms: boolean;
  push: boolean;
  bookingUpdates: boolean;
  messages: boolean;
  promotions: boolean;
}

export default function SettingsPage() {
  const [notifications, setNotifications] = useState<NotificationPrefs>({
    email: true,
    sms: false,
    push: true,
    bookingUpdates: true,
    messages: true,
    promotions: false,
  });
  const [theme, setTheme] = useState<"light" | "dark" | "system">("system");
  const [language, setLanguage] = useState("en");
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "success" | "error">("idle");

  useEffect(() => {
    notificationsService
      .getPreferences()
      .then((prefs) => {
        if (prefs && typeof prefs === "object") {
          setNotifications((prev) => ({ ...prev, ...prefs }));
        }
      })
      .catch(() => {
        // Preferences endpoint may not exist yet — use defaults
      });
  }, []);

  const toggleNotification = (key: keyof NotificationPrefs) => {
    setSaveStatus("idle");
    setNotifications((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    setSaveStatus("idle");
    try {
      await notificationsService.updatePreferences(notifications);
      setSaveStatus("success");
      setTimeout(() => setSaveStatus("idle"), 3000);
    } catch {
      setSaveStatus("error");
    } finally {
      setIsSaving(false);
    }
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
        <CardContent className="space-y-4">
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-secondary-900">
              Notification Channels
            </h3>
            <NotificationToggle
              icon={<Mail className="h-5 w-5" />}
              label="Email Notifications"
              description="Receive updates via email"
              enabled={notifications.email}
              onToggle={() => toggleNotification("email")}
            />
            <NotificationToggle
              icon={<Smartphone className="h-5 w-5" />}
              label="SMS Notifications"
              description="Receive updates via SMS"
              enabled={notifications.sms}
              onToggle={() => toggleNotification("sms")}
            />
            <NotificationToggle
              icon={<Bell className="h-5 w-5" />}
              label="Push Notifications"
              description="Receive in-app push notifications"
              enabled={notifications.push}
              onToggle={() => toggleNotification("push")}
            />
          </div>

          <div className="border-t pt-4">
            <h3 className="mb-4 text-sm font-medium text-secondary-900">
              Notification Types
            </h3>
            <NotificationToggle
              label="Booking Updates"
              description="Get notified about booking confirmations and changes"
              enabled={notifications.bookingUpdates}
              onToggle={() => toggleNotification("bookingUpdates")}
            />
            <NotificationToggle
              label="New Messages"
              description="Get notified when you receive new messages"
              enabled={notifications.messages}
              onToggle={() => toggleNotification("messages")}
            />
            <NotificationToggle
              label="Promotions & Tips"
              description="Receive promotional offers and service tips"
              enabled={notifications.promotions}
              onToggle={() => toggleNotification("promotions")}
            />
          </div>
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

          <div className="flex items-center justify-between rounded-lg border border-secondary-200 p-4">
            <div>
              <h3 className="font-medium text-secondary-900">Active Sessions</h3>
              <p className="text-sm text-secondary-500">
                You are currently signed in on this device
              </p>
            </div>
            <Button variant="outline" size="sm" disabled>
              1 active
            </Button>
          </div>

          <div className="flex items-center justify-between rounded-lg border border-secondary-200 p-4">
            <div>
              <h3 className="font-medium text-secondary-900">
                Download Your Data
              </h3>
              <p className="text-sm text-secondary-500">
                Get a copy of all your data — contact support to request
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                alert(
                  "To request your data export, email support@localservicefinder.com",
                )
              }
            >
              Request
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Save */}
      <div className="flex items-center justify-end gap-4">
        {saveStatus === "success" && (
          <span className="flex items-center gap-1.5 text-sm font-semibold text-green-600">
            <CheckCircle className="h-4 w-4" />
            Settings saved
          </span>
        )}
        {saveStatus === "error" && (
          <span className="flex items-center gap-1.5 text-sm font-semibold text-red-600">
            <AlertCircle className="h-4 w-4" />
            Failed to save
          </span>
        )}
        <Button onClick={handleSave} isLoading={isSaving}>
          Save Changes
        </Button>
      </div>
    </div>
  );
}

function NotificationToggle({
  icon,
  label,
  description,
  enabled,
  onToggle,
}: {
  icon?: React.ReactNode;
  label: string;
  description: string;
  enabled: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="flex items-center justify-between py-2">
      <div className="flex items-center gap-3">
        {icon && <span className="text-secondary-400">{icon}</span>}
        <div>
          <p className="font-medium text-secondary-900">{label}</p>
          <p className="text-sm text-secondary-500">{description}</p>
        </div>
      </div>
      <button
        onClick={onToggle}
        role="switch"
        aria-checked={enabled}
        className={`relative h-6 w-11 rounded-full transition-colors ${
          enabled ? "bg-primary-600" : "bg-secondary-300"
        }`}
      >
        <span
          className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
            enabled ? "translate-x-5" : "translate-x-0"
          }`}
        />
      </button>
    </div>
  );
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
