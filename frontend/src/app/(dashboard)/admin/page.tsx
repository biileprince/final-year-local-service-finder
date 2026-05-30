"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ShieldCheck,
  Users,
  Calendar,
  Star,
  Folder,
  History,
  TrendingUp,
  Flag,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { useRequireRole } from "@/hooks";
import { adminService, type DashboardStats, type RevenuePoint } from "@/lib/api/admin";
import { formatCurrency } from "@/lib/utils";

const TILES = [
  {
    href: "/admin/providers",
    title: "Verification queue",
    description: "Approve or reject providers waiting on verification.",
    icon: ShieldCheck,
  },
  {
    href: "/admin/users",
    title: "Users",
    description: "Search, suspend, change roles.",
    icon: Users,
  },
  {
    href: "/admin/bookings",
    title: "Bookings",
    description: "Cross-platform activity and force-cancel.",
    icon: Calendar,
  },
  {
    href: "/admin/reviews",
    title: "Review moderation",
    description: "Triage reported reviews — approve, hide, or delete.",
    icon: Star,
  },
  {
    href: "/admin/reports",
    title: "User reports",
    description: "Triage chat reports — action, dismiss, or mark reviewed.",
    icon: Flag,
  },
  {
    href: "/admin/categories",
    title: "Categories",
    description: "Create / edit service categories.",
    icon: Folder,
  },
  {
    href: "/admin/audit-logs",
    title: "Audit log",
    description: "Recent admin and system actions.",
    icon: History,
  },
];

export default function AdminHomePage() {
  const { isLoading: authLoading, hasRole } = useRequireRole(["ADMIN"]);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [revenue, setRevenue] = useState<RevenuePoint[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!hasRole) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [s, r] = await Promise.all([
          adminService.getDashboard().catch(() => null),
          adminService.getRevenue(30).catch(() => []),
        ]);
        if (cancelled) return;
        setStats(s);
        setRevenue(r);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [hasRole]);

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!hasRole) return null;

  const maxRev = revenue.reduce((m, p) => Math.max(m, p.revenue), 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-secondary-900">Admin</h1>
        <p className="mt-1 text-secondary-600">
          Platform overview and moderation tools.
        </p>
      </div>

      {/* Top metrics */}
      {stats && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Metric
            label="Users"
            value={stats.users.total}
            sub={`+${stats.users.newThisMonth} this month`}
            icon={<Users className="h-5 w-5" />}
            tone="bg-primary-50 text-primary-700"
          />
          <Metric
            label="Providers verified"
            value={stats.providers.verified}
            sub={`${stats.providers.pending} pending · ${stats.providers.rejected} rejected`}
            icon={<ShieldCheck className="h-5 w-5" />}
            tone="bg-emerald-50 text-emerald-700"
          />
          <Metric
            label="Bookings"
            value={stats.bookings.total}
            sub={`${stats.bookings.thisMonth} this month`}
            icon={<Calendar className="h-5 w-5" />}
            tone="bg-blue-50 text-blue-700"
          />
          <Metric
            label="Revenue (paid)"
            value={formatCurrency(stats.bookings.revenue)}
            sub={`${stats.reviews.reported} reviews flagged`}
            icon={<TrendingUp className="h-5 w-5" />}
            tone="bg-warning-50 text-warning-700"
          />
        </div>
      )}

      {/* Booking pipeline */}
      {stats && (
        <Card>
          <CardHeader>
            <CardTitle>Booking pipeline</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
              <Tile label="Pending" value={stats.bookings.pending} color="bg-warning-50 text-warning-700" />
              <Tile label="Confirmed" value={stats.bookings.confirmed} color="bg-blue-50 text-blue-700" />
              <Tile label="Completed" value={stats.bookings.completed} color="bg-emerald-50 text-emerald-700" />
              <Tile label="Cancelled" value={stats.bookings.cancelled} color="bg-red-50 text-red-700" />
              <Tile
                label="Avg rating"
                value={Number(stats.reviews.averageRating).toFixed(1)}
                color="bg-secondary-100 text-secondary-700"
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Revenue last 30 days */}
      <Card>
        <CardHeader>
          <CardTitle>Revenue · last 30 days</CardTitle>
        </CardHeader>
        <CardContent>
          {revenue.length === 0 ? (
            <p className="py-6 text-center text-sm text-secondary-500">
              No paid bookings in this window.
            </p>
          ) : (
            <div className="space-y-2">
              {revenue.slice(-10).map((p) => {
                const pct = maxRev > 0 ? Math.round((p.revenue / maxRev) * 100) : 0;
                return (
                  <div key={p.date}>
                    <div className="mb-1 flex justify-between text-xs">
                      <span className="text-secondary-600">{p.date}</span>
                      <span className="font-semibold text-secondary-900">
                        {formatCurrency(p.revenue)}
                      </span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-secondary-100">
                      <div
                        className="h-full rounded-full bg-emerald-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tile navigation */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {TILES.map((tile) => (
          <Link key={tile.href} href={tile.href} className="block">
            <Card className="h-full transition-colors hover:border-primary-300 hover:bg-primary-50/30">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <tile.icon className="h-5 w-5 text-primary-600" />
                  {tile.title}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-secondary-600">{tile.description}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
  sub,
  icon,
  tone,
}: {
  label: string;
  value: number | string;
  sub: string;
  icon: React.ReactNode;
  tone: string;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-6">
        <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${tone}`}>
          {icon}
        </div>
        <div className="min-w-0">
          <p className="text-2xl font-bold text-secondary-900">{value}</p>
          <p className="text-xs text-secondary-500">{label}</p>
          <p className="mt-0.5 truncate text-[11px] text-secondary-500">{sub}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function Tile({ label, value, color }: { label: string; value: number | string; color: string }) {
  return (
    <div className={`rounded-xl p-3 ${color}`}>
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-xs opacity-80">{label}</p>
    </div>
  );
}
