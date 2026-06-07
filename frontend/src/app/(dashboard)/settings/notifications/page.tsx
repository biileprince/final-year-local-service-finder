"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Bell,
  Mail,
  Smartphone,
  MessageSquare,
  Calendar,
  Star,
  Megaphone,
  ArrowLeft,
  CheckCircle,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { notificationsService } from "@/lib/api";

// ─── Types ───────────────────────────────────────────────────────────────────

interface NotificationPreferences {
  emailBookingUpdates: boolean;
  emailMessages: boolean;
  emailReviews: boolean;
  emailPromotions: boolean;
  smsBookingUpdates: boolean;
  smsMessages: boolean;
  smsReminders: boolean;
  pushEnabled: boolean;
  pushBookingUpdates: boolean;
  pushMessages: boolean;
}

const DEFAULTS: NotificationPreferences = {
  emailBookingUpdates: true,
  emailMessages: true,
  emailReviews: true,
  emailPromotions: false,
  smsBookingUpdates: true,
  smsMessages: false,
  smsReminders: true,
  pushEnabled: true,
  pushBookingUpdates: true,
  pushMessages: true,
};

// ─── Data ────────────────────────────────────────────────────────────────────

interface PrefRow {
  key: keyof NotificationPreferences;
  label: string;
  description: string;
  icon: React.ReactNode;
}

const emailPrefs: PrefRow[] = [
  {
    key: "emailBookingUpdates",
    label: "Booking updates",
    description: "Confirmations, cancellations, reminders, and completion prompts",
    icon: <Calendar className="h-4 w-4" />,
  },
  {
    key: "emailMessages",
    label: "New messages",
    description: "Email when someone sends you a message",
    icon: <MessageSquare className="h-4 w-4" />,
  },
  {
    key: "emailReviews",
    label: "Reviews",
    description: "New reviews and review responses",
    icon: <Star className="h-4 w-4" />,
  },
  {
    key: "emailPromotions",
    label: "Tips & promotions",
    description: "Product updates, tips, and promotional offers",
    icon: <Megaphone className="h-4 w-4" />,
  },
];

const smsPrefs: PrefRow[] = [
  {
    key: "smsBookingUpdates",
    label: "Booking updates",
    description: "SMS for confirmations and status changes",
    icon: <Calendar className="h-4 w-4" />,
  },
  {
    key: "smsMessages",
    label: "New messages",
    description: "SMS when someone sends you a message",
    icon: <MessageSquare className="h-4 w-4" />,
  },
  {
    key: "smsReminders",
    label: "Booking reminders",
    description: "SMS reminder before upcoming bookings",
    icon: <Bell className="h-4 w-4" />,
  },
];

const pushPrefs: PrefRow[] = [
  {
    key: "pushEnabled",
    label: "Enable push notifications",
    description: "Master toggle for all in-app push notifications",
    icon: <Bell className="h-4 w-4" />,
  },
  {
    key: "pushBookingUpdates",
    label: "Booking updates",
    description: "Push notification for booking activity",
    icon: <Calendar className="h-4 w-4" />,
  },
  {
    key: "pushMessages",
    label: "New messages",
    description: "Push notification for new messages",
    icon: <MessageSquare className="h-4 w-4" />,
  },
];

// ─── Page ────────────────────────────────────────────────────────────────────

export default function NotificationPreferencesPage() {
  const [prefs, setPrefs] = useState<NotificationPreferences>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");

  useEffect(() => {
    notificationsService
      .getPreferences()
      .then((data) => {
        if (data && typeof data === "object") {
          setPrefs((prev) => ({ ...prev, ...data }));
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const toggle = (key: keyof NotificationPreferences) => {
    setStatus("idle");
    setPrefs((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const save = async () => {
    setSaving(true);
    setStatus("idle");
    try {
      await notificationsService.updatePreferences(prefs);
      setStatus("success");
      setTimeout(() => setStatus("idle"), 3000);
    } catch {
      setStatus("error");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-primary-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          href="/settings"
          className="rounded-lg p-2 text-secondary-500 transition-colors hover:bg-secondary-100 hover:text-secondary-900"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-secondary-900">
            Notification Preferences
          </h1>
          <p className="mt-0.5 text-secondary-600">
            Choose how and when you want to be notified
          </p>
        </div>
      </div>

      {/* Email */}
      <PreferenceSection
        icon={<Mail className="h-5 w-5" />}
        title="Email"
        description="Transactional emails for important account activity"
        rows={emailPrefs}
        prefs={prefs}
        onToggle={toggle}
      />

      {/* SMS */}
      <PreferenceSection
        icon={<Smartphone className="h-5 w-5" />}
        title="SMS"
        description="Text messages for time-sensitive updates"
        rows={smsPrefs}
        prefs={prefs}
        onToggle={toggle}
      />

      {/* Push / In-app */}
      <PreferenceSection
        icon={<Bell className="h-5 w-5" />}
        title="Push & In-app"
        description="Browser and in-app notification alerts"
        rows={pushPrefs}
        prefs={prefs}
        onToggle={toggle}
        masterKey="pushEnabled"
      />

      {/* Save */}
      <div className="flex items-center justify-end gap-4">
        {status === "success" && (
          <span className="flex items-center gap-1.5 text-sm font-semibold text-green-600">
            <CheckCircle className="h-4 w-4" />
            Preferences saved
          </span>
        )}
        {status === "error" && (
          <span className="flex items-center gap-1.5 text-sm font-semibold text-red-600">
            <AlertCircle className="h-4 w-4" />
            Failed to save
          </span>
        )}
        <Button onClick={save} isLoading={saving}>
          Save Changes
        </Button>
      </div>
    </div>
  );
}

// ─── Section ─────────────────────────────────────────────────────────────────

function PreferenceSection({
  icon,
  title,
  description,
  rows,
  prefs,
  onToggle,
  masterKey,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  rows: PrefRow[];
  prefs: NotificationPreferences;
  onToggle: (key: keyof NotificationPreferences) => void;
  masterKey?: keyof NotificationPreferences;
}) {
  const masterOff = masterKey ? !prefs[masterKey] : false;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {icon}
          {title}
        </CardTitle>
        <p className="text-sm text-secondary-500">{description}</p>
      </CardHeader>
      <CardContent className="space-y-1">
        {rows.map((row) => {
          const isDisabled = masterOff && row.key !== masterKey;
          return (
            <div
              key={row.key}
              className={`flex items-center justify-between rounded-lg px-3 py-3 transition-colors ${
                isDisabled ? "opacity-40" : "hover:bg-secondary-50"
              }`}
            >
              <div className="flex items-center gap-3">
                <span className="text-secondary-400">{row.icon}</span>
                <div>
                  <p className="text-sm font-medium text-secondary-900">
                    {row.label}
                  </p>
                  <p className="text-xs text-secondary-500">
                    {row.description}
                  </p>
                </div>
              </div>
              <button
                role="switch"
                aria-checked={prefs[row.key]}
                disabled={isDisabled}
                onClick={() => onToggle(row.key)}
                className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
                  prefs[row.key] ? "bg-primary-600" : "bg-secondary-300"
                } ${isDisabled ? "cursor-not-allowed" : "cursor-pointer"}`}
              >
                <span
                  className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                    prefs[row.key] ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
