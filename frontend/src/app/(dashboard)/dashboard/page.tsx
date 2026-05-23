"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Calendar,
  MessageSquare,
  Star,
  TrendingUp,
  ArrowRight,
  Clock,
  MailWarning,
  Wallet,
  CheckCircle2,
  Briefcase,
  ImageIcon,
  BarChart3,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/spinner";
import { useAuth } from "@/hooks";
import { bookingsService, messagesService, providersService } from "@/lib/api";
import type { Booking, Conversation, Provider } from "@/types";
import { formatDate, formatTime, formatCurrency } from "@/lib/utils";

const statusColors: Record<
  string,
  "default" | "success" | "warning" | "error"
> = {
  PENDING: "warning",
  CONFIRMED: "default",
  IN_PROGRESS: "default",
  COMPLETED: "success",
  CANCELLED: "error",
};

export default function DashboardPage() {
  const { user } = useAuth();
  const router = useRouter();

  // Admins don't have a customer-style dashboard — send them to /admin.
  useEffect(() => {
    if (user?.role === "ADMIN") router.replace("/admin");
  }, [user, router]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState({
    totalBookings: 0,
    pendingBookings: 0,
    completedBookings: 0,
    unreadMessages: 0,
  });
  const [providerProfile, setProviderProfile] = useState<Provider | null>(null);
  const [providerEarnings, setProviderEarnings] = useState(0);

  useEffect(() => {
    loadDashboardData();
  }, [user]);

  const loadDashboardData = async () => {
    if (!user) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      let provider: Provider | null = null;
      if (user.role === "PROVIDER") {
        try {
          provider = await providersService.getMyProfile();
          setProviderProfile(provider);
        } catch {
          provider = null;
        }
      }

      const [bookingsData, conversationsData, unreadCount, statsData] =
        await Promise.all([
          user.role === "PROVIDER" && provider
            ? bookingsService.getProviderBookings(provider.id, { limit: 5 })
            : bookingsService.getCustomerBookings({ limit: 5 }),
          messagesService.getConversations(),
          messagesService.getUnreadCount(),
          user.role === "PROVIDER" && provider
            ? bookingsService.getStats(provider.id).catch(() => ({}))
            : Promise.resolve({} as Record<string, number>),
        ]);

      setBookings(bookingsData.data || []);
      setConversations(conversationsData.slice(0, 3));

      if (user.role === "PROVIDER") {
        const s = statsData as Record<string, number>;
        const totalFromStats =
          (s.pending || 0) +
          (s.confirmed || 0) +
          (s.in_progress || 0) +
          (s.completed || 0) +
          (s.cancelled || 0);
        setStats({
          totalBookings: totalFromStats || bookingsData.pagination?.total || 0,
          pendingBookings: s.pending || 0,
          completedBookings: s.completed || 0,
          unreadMessages: unreadCount.total || 0,
        });
        // Provider earnings: sum of finalAmount on PAID completed bookings.
        // Since stats endpoint doesn't return revenue, fetch a wider page of completed bookings.
        try {
          const completed = await bookingsService.getProviderBookings(
            provider!.id,
            { status: "COMPLETED", limit: 100 },
          );
          const earnings = (completed.data || []).reduce(
            (sum, b) =>
              b.paymentStatus === "PAID"
                ? sum + Number(b.finalAmount || 0)
                : sum,
            0,
          );
          setProviderEarnings(earnings);
        } catch {
          setProviderEarnings(0);
        }
      } else {
        setStats({
          totalBookings: bookingsData.pagination?.total || 0,
          pendingBookings:
            bookingsData.data?.filter((b) => b.status === "PENDING").length ||
            0,
          completedBookings:
            bookingsData.data?.filter((b) => b.status === "COMPLETED").length ||
            0,
          unreadMessages: unreadCount.total || 0,
        });
      }
    } catch (error) {
      console.error("Failed to load dashboard data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-8">
        <div className="space-y-2">
          <Skeleton className="h-7 w-72" />
          <Skeleton className="h-4 w-96" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div className="space-y-2">
                    <Skeleton className="h-3 w-20" />
                    <Skeleton className="h-7 w-16" />
                  </div>
                  <Skeleton className="h-10 w-10 rounded-lg" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="space-y-4 p-5">
                <Skeleton className="h-5 w-40" />
                {Array.from({ length: 3 }).map((__, j) => (
                  <div key={j} className="flex items-start gap-3">
                    <Skeleton className="h-10 w-10 rounded-full" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-1/2" />
                      <Skeleton className="h-3 w-2/3" />
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Welcome Section */}
      <div>
        <h1 className="text-2xl font-bold text-secondary-900">
          Welcome back, {user?.name?.split(" ")[0]}!
        </h1>
        <p className="mt-1 text-secondary-600">
          Here's what's happening with your{" "}
          {user?.role === "PROVIDER" ? "business" : "bookings"} today.
        </p>
      </div>

      {/* Email verification banner */}
      {user && !user.emailVerifiedAt && (
        <div className="flex flex-col gap-3 rounded-2xl border-2 border-amber-200 bg-amber-50 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <MailWarning className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
            <div>
              <p className="font-semibold text-amber-900">
                Verify your email address
              </p>
              <p className="text-sm text-amber-700">
                We emailed you a 6-digit code. Enter it to unlock bookings and
                messaging.
              </p>
            </div>
          </div>
          <Button
            asChild
            size="sm"
            variant="outline"
            className="shrink-0 border-amber-300 text-amber-800 hover:bg-amber-100"
          >
            <Link href="/verify-email">Enter code</Link>
          </Button>
        </div>
      )}

      {/* Provider verification banner */}
      {user?.role === "PROVIDER" && providerProfile &&
        providerProfile.verificationStatus !== "VERIFIED" && (
          <div className="flex flex-col gap-3 rounded-2xl border-2 border-blue-200 bg-blue-50 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-blue-600" />
              <div>
                <p className="font-semibold text-blue-900">
                  {providerProfile.verificationStatus === "PENDING"
                    ? "Verification in progress"
                    : "Verification rejected"}
                </p>
                <p className="text-sm text-blue-700">
                  {providerProfile.verificationStatus === "PENDING"
                    ? "Your provider profile is awaiting review. You can still receive bookings while verification is pending."
                    : "Please update your profile and re-submit for verification."}
                </p>
              </div>
            </div>
          </div>
        )}

      {/* Stats Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="flex items-center gap-4 p-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary-100">
              <Calendar className="h-6 w-6 text-primary-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-secondary-900">
                {stats.totalBookings}
              </p>
              <p className="text-sm text-secondary-500">Total Bookings</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-4 p-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-warning-50">
              <Clock className="h-6 w-6 text-warning-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-secondary-900">
                {stats.pendingBookings}
              </p>
              <p className="text-sm text-secondary-500">Pending</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-4 p-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-success-50">
              <Star className="h-6 w-6 text-success-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-secondary-900">
                {stats.completedBookings}
              </p>
              <p className="text-sm text-secondary-500">Completed</p>
            </div>
          </CardContent>
        </Card>

        {user?.role === "PROVIDER" ? (
          <Card>
            <CardContent className="flex items-center gap-4 p-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-50">
                <Wallet className="h-6 w-6 text-emerald-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-secondary-900">
                  {formatCurrency(providerEarnings)}
                </p>
                <p className="text-sm text-secondary-500">Total Earnings</p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="flex items-center gap-4 p-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-info-50">
                <MessageSquare className="h-6 w-6 text-info-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-secondary-900">
                  {stats.unreadMessages}
                </p>
                <p className="text-sm text-secondary-500">Unread Messages</p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Provider snapshot row */}
      {user?.role === "PROVIDER" && providerProfile && (
        <div className="grid gap-4 sm:grid-cols-3">
          <Card>
            <CardContent className="flex items-center gap-4 p-6">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-warning-50">
                <Star className="h-5 w-5 text-warning-600" />
              </div>
              <div>
                <p className="text-xl font-bold text-secondary-900">
                  {Number(providerProfile.rating).toFixed(1)}
                </p>
                <p className="text-sm text-secondary-500">
                  {providerProfile.reviewCount} reviews
                </p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-4 p-6">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary-100">
                <CheckCircle2 className="h-5 w-5 text-primary-600" />
              </div>
              <div>
                <p className="text-xl font-bold text-secondary-900">
                  {providerProfile.completedBookings}
                </p>
                <p className="text-sm text-secondary-500">Jobs completed</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-4 p-6">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-secondary-100">
                <Briefcase className="h-5 w-5 text-secondary-700" />
              </div>
              <div>
                <p className="text-xl font-bold text-secondary-900">
                  {providerProfile.categories?.length || 0}
                </p>
                <p className="text-sm text-secondary-500">Service categories</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="grid gap-8 lg:grid-cols-2">
        {/* Recent Bookings */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Recent Bookings</CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/bookings">
                View All <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {bookings.length === 0 ? (
              <div className="py-8 text-center">
                <Calendar className="mx-auto h-12 w-12 text-secondary-300" />
                <p className="mt-2 text-secondary-500">No bookings yet</p>
                {user?.role === "CUSTOMER" && (
                  <Button asChild className="mt-4">
                    <Link href="/search">Find Services</Link>
                  </Button>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                {bookings.map((booking) => (
                  <Link
                    key={booking.id}
                    href={`/bookings/${booking.id}`}
                    className="flex items-center gap-4 rounded-lg p-3 transition-colors hover:bg-secondary-50"
                  >
                    <Avatar
                      size="default"
                      src={
                        user?.role === "PROVIDER"
                          ? booking.customer?.profileImage
                          : booking.provider?.user?.profileImage
                      }
                      name={
                        user?.role === "PROVIDER"
                          ? booking.customer?.name
                          : booking.provider?.user?.name
                      }
                    />
                    <div className="flex-1 overflow-hidden">
                      <p className="truncate font-medium text-secondary-900">
                        {user?.role === "PROVIDER"
                          ? booking.customer?.name
                          : booking.provider?.user?.name}
                      </p>
                      <p className="text-sm text-secondary-500">
                        {formatDate(booking.scheduledDate)} at{" "}
                        {formatTime(booking.scheduledStartTime)}
                      </p>
                    </div>
                    <Badge variant={statusColors[booking.status] || "default"}>
                      {booking.status}
                    </Badge>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Messages */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Recent Messages</CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/messages">
                View All <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {conversations.length === 0 ? (
              <div className="py-8 text-center">
                <MessageSquare className="mx-auto h-12 w-12 text-secondary-300" />
                <p className="mt-2 text-secondary-500">No messages yet</p>
              </div>
            ) : (
              <div className="space-y-4">
                {conversations.map((conversation) => {
                  const otherUser =
                    user?.role === "PROVIDER"
                      ? conversation.customer
                      : conversation.provider?.user;
                  const unreadCount =
                    user?.role === "PROVIDER"
                      ? conversation.providerUnreadCount
                      : conversation.customerUnreadCount;

                  return (
                    <Link
                      key={conversation.id}
                      href={`/messages/${conversation.id}`}
                      className="flex items-center gap-4 rounded-lg p-3 transition-colors hover:bg-secondary-50"
                    >
                      <Avatar
                        size="default"
                        src={otherUser?.profileImage}
                        name={otherUser?.name}
                      />
                      <div className="flex-1 overflow-hidden">
                        <p className="truncate font-medium text-secondary-900">
                          {otherUser?.name}
                        </p>
                        <p className="truncate text-sm text-secondary-500">
                          {conversation.lastMessagePreview || "No messages"}
                        </p>
                      </div>
                      {unreadCount > 0 && (
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary-600 text-xs text-white">
                          {unreadCount}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            {user?.role === "CUSTOMER" ? (
              <>
                <Button asChild>
                  <Link href="/search">Find a service provider</Link>
                </Button>
                <Button variant="outline" asChild>
                  <Link href="/bookings">View All Bookings</Link>
                </Button>
                <Button variant="outline" asChild>
                  <Link href="/messages">Check Messages</Link>
                </Button>
              </>
            ) : (
              <>
                <Button asChild>
                  <Link href="/bookings">
                    <Calendar className="mr-2 h-4 w-4" />
                    Manage Bookings
                  </Link>
                </Button>
                <Button variant="outline" asChild>
                  <Link href="/availability">
                    <TrendingUp className="mr-2 h-4 w-4" />
                    Set Availability
                  </Link>
                </Button>
                <Button variant="outline" asChild>
                  <Link href="/services">
                    <Briefcase className="mr-2 h-4 w-4" />
                    My Services
                  </Link>
                </Button>
                <Button variant="outline" asChild>
                  <Link href="/analytics">
                    <BarChart3 className="mr-2 h-4 w-4" />
                    Analytics
                  </Link>
                </Button>
                {providerProfile && (
                  <Button variant="outline" asChild>
                    <Link
                      href={`/providers/${providerProfile.id}`}
                      target="_blank"
                    >
                      <ImageIcon className="mr-2 h-4 w-4" />
                      View public profile
                    </Link>
                  </Button>
                )}
                <Button variant="outline" asChild>
                  <Link href="/profile">Edit Profile</Link>
                </Button>
              </>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
