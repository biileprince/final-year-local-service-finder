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
  CheckCircle,
  Circle,
  AlertTriangle,
  Sparkles,
  Phone,
  Camera,
  Wrench,
  Tag,
  ShieldCheck,
  MapPin,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/spinner";
import { useAuth } from "@/hooks";
import { bookingsService, messagesService, providersService } from "@/lib/api";
import type { Booking, Conversation, Provider, ProviderService } from "@/types";
import { cn } from "@/lib/utils";
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
  const [providerServiceCount, setProviderServiceCount] = useState(0);

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

        // Service count powers the "Add service prices" checklist row. Failure
        // here is fine — we just treat it as 0 and the checklist nudges them.
        try {
          const services = await providersService.getMyServices();
          setProviderServiceCount(
            services.filter((s: ProviderService) => s.isActive).length,
          );
        } catch {
          setProviderServiceCount(0);
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

      {/* Provider profile-completeness checklist — surfaces the EXACT items
          the provider needs to complete (specialties, services, ID doc, etc.)
          right on the dashboard so they're not lost in onboarding/profile
          pages. Hidden once everything's done. */}
      {user?.role === "PROVIDER" && providerProfile && (
        <ProviderProfileChecklist
          provider={providerProfile}
          activeServiceCount={providerServiceCount}
        />
      )}

      {/* Provider verification banner */}
      {user?.role === "PROVIDER" &&
        providerProfile &&
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
                      aria-label={`Open conversation with ${otherUser?.name ?? "user"}`}
                      className="group flex items-center gap-4 rounded-lg p-3 transition-colors hover:bg-primary-50"
                    >
                      <Avatar
                        size="default"
                        src={otherUser?.profileImage}
                        name={otherUser?.name}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium text-secondary-900">
                          {otherUser?.name}
                        </p>
                        <p className="truncate text-sm text-secondary-500">
                          {conversation.lastMessagePreview || "No messages"}
                        </p>
                      </div>
                      {unreadCount > 0 && (
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary-600 text-xs font-bold text-white">
                          {unreadCount}
                        </span>
                      )}
                      <span className="hidden shrink-0 items-center gap-1 rounded-full bg-primary-100 px-2 py-0.5 text-[10px] font-bold text-primary-700 transition-colors group-hover:bg-primary-200 sm:inline-flex">
                        Open
                        <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
                      </span>
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

// ─── Provider profile-completeness checklist ────────────────────────────────
// Lists each profile field still needed (bio, location, phone, photo, categories,
// specialties, services, ID doc, gallery) with a direct link to fix it. Hidden
// once everything is done. Each missing item is a tap-target so a less-literate
// provider can navigate themselves to the right page without reading prose.

interface ChecklistItem {
  key: string;
  label: string;
  hint: string;
  icon: React.ComponentType<{ className?: string }>;
  done: boolean;
  href: string;
  required: boolean;
}

function ProviderProfileChecklist({
  provider,
  activeServiceCount,
}: {
  provider: Provider;
  activeServiceCount: number;
}) {
  // All provider-profile fields now live on the /services page (the dedicated
  // "Manage my services" hub), so every checklist link points there with an
  // #anchor hash that the destination uses to scroll to the right section.
  const items: ChecklistItem[] = [
    {
      key: "bio",
      label: "Write a short bio",
      hint: "At least 30 characters about the services you offer.",
      icon: Sparkles,
      done: (provider.bio?.trim().length ?? 0) >= 30,
      href: "/services#section-profile",
      required: true,
    },
    {
      key: "location",
      label: "Set your service location",
      hint: "Pick the city or neighbourhood you operate from.",
      icon: MapPin,
      done: !!provider.location && provider.location.trim().length > 1,
      href: "/services#section-profile",
      required: true,
    },
    {
      key: "phone",
      label: "Add your phone number",
      hint: "Customers see it once they book — required for confirmations.",
      icon: Phone,
      done: !!provider.user?.phone && provider.user.phone.trim().length > 0,
      href: "/profile",
      required: true,
    },
    {
      key: "photo",
      label: "Upload a profile photo",
      hint: "Profiles with a photo get up to 3× more booking requests.",
      icon: Camera,
      done: !!provider.user?.profileImage,
      href: "/profile",
      required: false,
    },
    {
      key: "categories",
      label: "Pick service categories",
      hint: "Tells us where to list you (Plumbing, Cleaning, etc.).",
      icon: Tag,
      done: (provider.categories?.length ?? 0) > 0,
      href: "/services#section-categories",
      required: true,
    },
    {
      key: "specialties",
      label: "List your specialties",
      hint: 'Free-text tags like "Pipe leak repair" — they boost search match.',
      icon: Sparkles,
      done: (provider.specialties?.length ?? 0) > 0,
      href: "/services#section-specialties",
      required: false,
    },
    {
      key: "services",
      label: "Set service prices",
      hint: "Customers compare prices before booking — add at least one.",
      icon: Wrench,
      done: activeServiceCount > 0,
      href: "/services#section-services",
      required: true,
    },
    {
      key: "availability",
      label: "Set your weekly availability",
      hint: "Tell us which days and hours you accept bookings.",
      icon: Calendar,
      // We can't tell from the provider record whether they've set availability,
      // so this row stays as a nudge until they visit /availability. Treat as
      // optional — it's a productivity boost, not a blocker for verification.
      done: false,
      href: "/availability",
      required: false,
    },
    {
      key: "id-doc",
      label: "Upload an ID for verification",
      hint: "Required for the blue verified badge that unlocks the public list.",
      icon: ShieldCheck,
      done: !!provider.idDocumentId,
      href: "/services#section-verification",
      required: true,
    },
    {
      key: "gallery",
      label: "Add a few photos of your work",
      hint: "Gallery photos are the #1 booking driver for new providers.",
      icon: ImageIcon,
      done: (provider.gallery?.length ?? 0) > 0,
      href: "/services#section-gallery",
      required: false,
    },
  ];

  const completed = items.filter((i) => i.done).length;
  const total = items.length;
  const percent = Math.round((completed / total) * 100);
  const missingRequired = items.filter((i) => i.required && !i.done);

  // Don't render at all once everything is done — no clutter for fully set-up
  // providers. They still see the verification banner if pending.
  if (completed === total) return null;

  return (
    <Card className="border-2 border-primary-200 bg-primary-50/30">
      <CardContent className="p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-bold text-secondary-900">
              <Sparkles className="h-5 w-5 text-primary-600" />
              Complete your provider profile
            </h2>
            <p className="mt-1 text-sm text-secondary-600">
              {missingRequired.length > 0 ? (
                <>
                  <span className="font-bold text-amber-700">
                    {missingRequired.length} required item
                    {missingRequired.length === 1 ? "" : "s"} left
                  </span>{" "}
                  before customers can find you.
                </>
              ) : (
                <>
                  You&apos;re live! A few optional items remain to boost
                  bookings.
                </>
              )}
            </p>
          </div>
          <div className="text-right">
            <p className="text-3xl font-bold text-primary-700">{percent}%</p>
            <p className="text-xs font-semibold uppercase tracking-wide text-secondary-500">
              {completed} of {total} done
            </p>
          </div>
        </div>

        {/* Where-to-edit hint — explicitly tells the provider that the
            service profile lives under "My Services" so they don't go
            hunting in /profile (which is the personal account page). */}
        <Link
          href="/services"
          className="mt-4 flex items-start gap-3 rounded-xl border border-primary-200 bg-white p-3 transition-colors hover:border-primary-400 hover:bg-primary-50"
        >
          <Wrench className="mt-0.5 h-5 w-5 shrink-0 text-primary-600" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-secondary-900">
              Manage everything from <span className="text-primary-700">My Services</span>
            </p>
            <p className="text-xs text-secondary-600">
              Bio, categories, specialties, prices, ID and gallery — all live on
              your <strong>/services</strong> page. Tap any item below to jump
              straight to the right section.
            </p>
          </div>
          <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-primary-600" />
        </Link>

        {/* Progress bar */}
        <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-secondary-200">
          <div
            className="h-full rounded-full bg-linear-to-r from-primary-500 to-amber-500 transition-all duration-500"
            style={{ width: `${percent}%` }}
            aria-hidden
          />
        </div>

        {/* Checklist items — each is a link to the relevant page so they
            can fix the gap in one tap. */}
        <ul className="mt-5 space-y-2">
          {items.map((item) => {
            const Icon = item.icon;
            return (
              <li key={item.key}>
                <Link
                  href={item.href}
                  className={cn(
                    "group flex items-start gap-3 rounded-xl border-2 p-3 transition-all",
                    item.done
                      ? "border-emerald-200 bg-white"
                      : "border-secondary-200 bg-white hover:border-primary-300 hover:bg-primary-50",
                  )}
                >
                  <span
                    className={cn(
                      "flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
                      item.done
                        ? "bg-emerald-100 text-emerald-700"
                        : item.required
                          ? "bg-amber-100 text-amber-700"
                          : "bg-secondary-100 text-secondary-500",
                    )}
                  >
                    {item.done ? (
                      <CheckCircle className="h-5 w-5" />
                    ) : (
                      <Icon className="h-4 w-4" />
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p
                      className={cn(
                        "flex items-center gap-2 text-sm font-bold",
                        item.done
                          ? "text-emerald-800 line-through decoration-emerald-300"
                          : "text-secondary-900",
                      )}
                    >
                      {item.label}
                      {!item.done && item.required && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-800">
                          <AlertTriangle className="h-2.5 w-2.5" />
                          Required
                        </span>
                      )}
                      {!item.done && !item.required && (
                        <span className="rounded-full bg-secondary-100 px-2 py-0.5 text-[10px] font-bold uppercase text-secondary-600"></span>
                      )}
                    </p>
                    <p className="mt-0.5 text-xs text-secondary-600">
                      {item.hint}
                    </p>
                  </div>
                  {!item.done && (
                    <span className="hidden shrink-0 self-center rounded-full bg-primary-600 px-3 py-1.5 text-xs font-bold text-white transition-colors group-hover:bg-primary-700 sm:inline-flex">
                      Fix it →
                    </span>
                  )}
                  <Circle
                    aria-hidden
                    className={cn(
                      "h-4 w-4 shrink-0 self-center sm:hidden",
                      item.done ? "hidden" : "text-secondary-300",
                    )}
                  />
                </Link>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}
