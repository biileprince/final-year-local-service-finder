"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  BarChart3,
  Wallet,
  CheckCircle2,
  Clock,
  XCircle,
  TrendingUp,
  Star,
  Calendar,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { useRequireRole } from "@/hooks";
import { providersService, bookingsService } from "@/lib/api";
import type { Provider, Booking } from "@/types";
import { formatCurrency, formatDate } from "@/lib/utils";

type Range = "30d" | "90d" | "all";

function rangeToDate(range: Range): Date | null {
  if (range === "all") return null;
  const days = range === "30d" ? 30 : 90;
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(0, 0, 0, 0);
  return d;
}

export default function ProviderAnalyticsPage() {
  const { user, isLoading: authLoading, hasRole } = useRequireRole(["PROVIDER"]);
  const [provider, setProvider] = useState<Provider | null>(null);
  const [stats, setStats] = useState<Record<string, number>>({});
  const [completed, setCompleted] = useState<Booking[]>([]);
  const [range, setRange] = useState<Range>("30d");
  const [loading, setLoading] = useState(true);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);

  useEffect(() => {
    if (!user || !hasRole) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const me = await providersService.getMyProfile();
        if (cancelled) return;
        setProvider(me);

        const [s, completedRes] = await Promise.all([
          bookingsService.getStats(me.id).catch(() => ({})),
          bookingsService.getProviderBookings(me.id, {
            status: "COMPLETED",
            limit: 200,
          }),
        ]);
        if (cancelled) return;
        setStats(s as Record<string, number>);
        setCompleted(completedRes.data || []);
      } catch (err) {
        // No provider row yet — send them to finish onboarding rather than
        // crashing on a NotFound.
        const msg = err instanceof Error ? err.message.toLowerCase() : "";
        if (msg.includes("not found") || msg.includes("404")) {
          if (!cancelled) setNeedsOnboarding(true);
        } else {
          throw err;
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user, hasRole]);

  const filtered = useMemo(() => {
    const cutoff = rangeToDate(range);
    if (!cutoff) return completed;
    return completed.filter((b) => new Date(b.scheduledDate) >= cutoff);
  }, [completed, range]);

  const earnings = filtered.reduce(
    (sum, b) =>
      b.paymentStatus === "PAID" ? sum + Number(b.finalAmount || 0) : sum,
    0,
  );
  const paidCount = filtered.filter((b) => b.paymentStatus === "PAID").length;
  const unpaidCount = filtered.filter(
    (b) => b.paymentStatus !== "PAID",
  ).length;
  const avgValue = paidCount > 0 ? earnings / paidCount : 0;

  // Group earnings by month label, oldest → newest
  const byMonth = useMemo(() => {
    const map = new Map<string, number>();
    filtered.forEach((b) => {
      if (b.paymentStatus !== "PAID") return;
      const d = new Date(b.scheduledDate);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      map.set(key, (map.get(key) || 0) + Number(b.finalAmount || 0));
    });
    const entries = Array.from(map.entries()).sort((a, b) =>
      a[0] < b[0] ? -1 : 1,
    );
    return entries;
  }, [filtered]);

  const maxMonthly = byMonth.reduce((m, [, v]) => Math.max(m, v), 0);

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!hasRole) return null;

  if (needsOnboarding) {
    return (
      <Card>
        <CardContent className="py-16 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-100">
            <BarChart3 className="h-7 w-7 text-primary-600" />
          </div>
          <h2 className="mt-5 text-xl font-bold text-secondary-900">
            Analytics will appear once your profile is live
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-secondary-600">
            Finish provider onboarding so we can start tracking your earnings,
            completion rate, and reputation.
          </p>
          <Button asChild className="mt-6">
            <Link href="/onboarding">Continue onboarding</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!provider) return null;

  const total =
    (stats.pending || 0) +
    (stats.confirmed || 0) +
    (stats.in_progress || 0) +
    (stats.completed || 0) +
    (stats.cancelled || 0);
  const completionRate =
    total > 0 ? Math.round(((stats.completed || 0) / total) * 100) : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-secondary-900">Analytics</h1>
          <p className="mt-1 text-secondary-600">
            Earnings and performance for {provider.user.name}.
          </p>
        </div>
        <div className="flex gap-2">
          {(["30d", "90d", "all"] as Range[]).map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors ${
                range === r
                  ? "bg-primary-600 text-white"
                  : "bg-white text-secondary-700 hover:bg-secondary-100"
              }`}
            >
              {r === "30d"
                ? "Last 30 days"
                : r === "90d"
                  ? "Last 90 days"
                  : "All time"}
            </button>
          ))}
        </div>
      </div>

      {/* Top metrics */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="flex items-center gap-4 p-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-50">
              <Wallet className="h-6 w-6 text-emerald-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-secondary-900">
                {formatCurrency(earnings)}
              </p>
              <p className="text-sm text-secondary-500">Earnings</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary-100">
              <CheckCircle2 className="h-6 w-6 text-primary-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-secondary-900">
                {paidCount}
              </p>
              <p className="text-sm text-secondary-500">Paid jobs</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-warning-50">
              <TrendingUp className="h-6 w-6 text-warning-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-secondary-900">
                {formatCurrency(avgValue)}
              </p>
              <p className="text-sm text-secondary-500">Avg job value</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-secondary-100">
              <BarChart3 className="h-6 w-6 text-secondary-700" />
            </div>
            <div>
              <p className="text-2xl font-bold text-secondary-900">
                {completionRate}%
              </p>
              <p className="text-sm text-secondary-500">Completion rate</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Booking status breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>Booking pipeline</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            <StatusTile
              icon={<Clock className="h-4 w-4" />}
              label="Pending"
              count={stats.pending || 0}
              color="text-warning-700 bg-warning-50"
            />
            <StatusTile
              icon={<CheckCircle2 className="h-4 w-4" />}
              label="Confirmed"
              count={stats.confirmed || 0}
              color="text-blue-700 bg-blue-50"
            />
            <StatusTile
              icon={<TrendingUp className="h-4 w-4" />}
              label="In progress"
              count={stats.in_progress || 0}
              color="text-purple-700 bg-purple-50"
            />
            <StatusTile
              icon={<CheckCircle2 className="h-4 w-4" />}
              label="Completed"
              count={stats.completed || 0}
              color="text-emerald-700 bg-emerald-50"
            />
            <StatusTile
              icon={<XCircle className="h-4 w-4" />}
              label="Cancelled"
              count={stats.cancelled || 0}
              color="text-red-700 bg-red-50"
            />
          </div>
        </CardContent>
      </Card>

      {/* Earnings over time */}
      <Card>
        <CardHeader>
          <CardTitle>Monthly earnings</CardTitle>
        </CardHeader>
        <CardContent>
          {byMonth.length === 0 ? (
            <div className="py-10 text-center text-sm text-secondary-500">
              No paid bookings yet for this period.
            </div>
          ) : (
            <div className="space-y-3">
              {byMonth.map(([key, value]) => {
                const [y, m] = key.split("-");
                const label = new Date(
                  Number(y),
                  Number(m) - 1,
                  1,
                ).toLocaleDateString("en-GH", {
                  month: "short",
                  year: "numeric",
                });
                const pct =
                  maxMonthly > 0 ? Math.round((value / maxMonthly) * 100) : 0;
                return (
                  <div key={key}>
                    <div className="mb-1 flex justify-between text-sm">
                      <span className="text-secondary-700">{label}</span>
                      <span className="font-semibold text-secondary-900">
                        {formatCurrency(value)}
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

      {/* Reputation & unpaid */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Reputation</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
              <div className="flex flex-col items-center">
                <div className="flex items-center gap-1">
                  <Star className="h-5 w-5 fill-warning-500 text-warning-500" />
                  <span className="text-3xl font-bold text-secondary-900">
                    {Number(provider.rating).toFixed(1)}
                  </span>
                </div>
                <p className="mt-1 text-xs text-secondary-500">Average</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-secondary-900">
                  {provider.reviewCount}
                </p>
                <p className="text-xs text-secondary-500">Total reviews</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-secondary-900">
                  {provider.completedBookings}
                </p>
                <p className="text-xs text-secondary-500">Lifetime jobs</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Unpaid completed jobs</CardTitle>
            <Badge variant={unpaidCount > 0 ? "warning" : "success"}>
              {unpaidCount}
            </Badge>
          </CardHeader>
          <CardContent>
            {unpaidCount === 0 ? (
              <p className="py-4 text-sm text-secondary-500">
                All caught up — every completed job has been paid.
              </p>
            ) : (
              <div className="space-y-2">
                {filtered
                  .filter((b) => b.paymentStatus !== "PAID")
                  .slice(0, 5)
                  .map((b) => (
                    <Link
                      key={b.id}
                      href={`/bookings/${b.id}`}
                      className="flex items-center justify-between rounded-lg p-2 transition-colors hover:bg-secondary-50"
                    >
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-secondary-400" />
                        <span className="text-sm text-secondary-700">
                          {formatDate(b.scheduledDate)} · {b.customer?.name}
                        </span>
                      </div>
                      <Badge variant="warning">{b.paymentStatus}</Badge>
                    </Link>
                  ))}
                {unpaidCount > 5 && (
                  <Button variant="ghost" size="sm" asChild>
                    <Link href="/bookings">View all</Link>
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StatusTile({
  icon,
  label,
  count,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  count: number;
  color: string;
}) {
  return (
    <div className="rounded-xl border border-secondary-100 p-4">
      <div
        className={`mb-2 inline-flex h-7 w-7 items-center justify-center rounded-lg ${color}`}
      >
        {icon}
      </div>
      <p className="text-2xl font-bold text-secondary-900">{count}</p>
      <p className="text-xs text-secondary-500">{label}</p>
    </div>
  );
}
