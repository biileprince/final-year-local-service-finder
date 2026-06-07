"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Calendar,
  Clock,
  MapPin,
  ChevronRight,
  Star,
  CheckCircle,
  Repeat,
  Download,
  Printer,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/spinner";
import { useAuth } from "@/hooks";
import { bookingsService, providersService } from "@/lib/api";
import type { Booking, BookingStatus, RecurringBooking } from "@/types";
import { formatDate, formatTime, formatCurrency, cn } from "@/lib/utils";
import {
  bookingsToCsv,
  downloadText,
  printBookings,
} from "@/lib/booking-export";

const statusConfig: Record<
  BookingStatus,
  {
    label: string;
    variant: "default" | "success" | "warning" | "error" | "info";
  }
> = {
  PENDING: { label: "Pending", variant: "warning" },
  CONFIRMED: { label: "Confirmed", variant: "info" },
  IN_PROGRESS: { label: "In Progress", variant: "default" },
  COMPLETED: { label: "Completed", variant: "success" },
  CANCELLED: { label: "Cancelled", variant: "error" },
  NO_SHOW: { label: "No-show", variant: "error" },
};

const tabs = [
  { value: "", label: "All" },
  { value: "PENDING", label: "Pending" },
  { value: "CONFIRMED", label: "Confirmed" },
  { value: "IN_PROGRESS", label: "In Progress" },
  { value: "COMPLETED", label: "Completed" },
  { value: "CANCELLED", label: "Cancelled" },
];

export default function BookingsPage() {
  const { user } = useAuth();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [providerId, setProviderId] = useState<string | null>(null);
  const [missingProviderProfile, setMissingProviderProfile] = useState(false);
  const [recurring, setRecurring] = useState<RecurringBooking[]>([]);

  useEffect(() => {
    loadBookings();
  }, [user, activeTab, page]);

  useEffect(() => {
    if (user?.role === "CUSTOMER") {
      bookingsService
        .getRecurring()
        .then(setRecurring)
        .catch(() => setRecurring([]));
    }
  }, [user]);

  const FREQUENCY_LABEL: Record<string, string> = {
    WEEKLY: "Weekly",
    BIWEEKLY: "Every 2 weeks",
    MONTHLY: "Monthly",
  };

  const handleStopSeries = async (id: string) => {
    if (!confirm("Stop this recurring booking? Existing bookings are kept."))
      return;
    try {
      await bookingsService.cancelRecurring(id);
      setRecurring((prev) =>
        prev.map((s) => (s.id === id ? { ...s, isActive: false } : s)),
      );
    } catch (err) {
      console.error("Failed to stop series:", err);
    }
  };

  // Pull the full (unpaginated) history for export/print.
  const fetchAllBookings = async (): Promise<Booking[]> => {
    if (user?.role === "PROVIDER") {
      if (!providerId) return [];
      const res = await bookingsService.getProviderBookings(providerId, {
        page: 1,
        limit: 1000,
      });
      return res.data || [];
    }
    const res = await bookingsService.getCustomerBookings({
      page: 1,
      limit: 1000,
    });
    return res.data || [];
  };

  const [exporting, setExporting] = useState(false);

  const handleExportCsv = async () => {
    setExporting(true);
    try {
      const all = await fetchAllBookings();
      downloadText(
        "booking-history.csv",
        bookingsToCsv(all, user?.role),
        "text/csv",
      );
    } catch (err) {
      console.error("Failed to export bookings:", err);
    } finally {
      setExporting(false);
    }
  };

  const handlePrint = async () => {
    setExporting(true);
    try {
      const all = await fetchAllBookings();
      printBookings(all, user?.role);
    } catch (err) {
      console.error("Failed to print bookings:", err);
    } finally {
      setExporting(false);
    }
  };

  const loadBookings = async () => {
    if (!user) return;

    setIsLoading(true);
    try {
      if (user.role === "PROVIDER") {
        // A provider who hasn't completed onboarding has no Provider row yet.
        // Surface a friendly empty state instead of crashing the page.
        let resolvedProviderId = providerId;
        if (!resolvedProviderId) {
          try {
            const provider = await providersService.getMyProfile();
            resolvedProviderId = provider.id;
            setProviderId(provider.id);
            setMissingProviderProfile(false);
          } catch (err) {
            const message =
              err instanceof Error ? err.message.toLowerCase() : "";
            if (message.includes("provider profile not found")) {
              setMissingProviderProfile(true);
              setBookings([]);
              setTotalPages(1);
              return;
            }
            throw err;
          }
        }
        const result = await bookingsService.getProviderBookings(
          resolvedProviderId!,
          {
            status: (activeTab as BookingStatus) || undefined,
            page,
            limit: 10,
          },
        );
        setBookings(result.data || []);
        setTotalPages(result.pagination?.totalPages || 1);
      } else {
        const result = await bookingsService.getCustomerBookings({
          status: (activeTab as BookingStatus) || undefined,
          page,
          limit: 10,
        });
        setBookings(result.data || []);
        setTotalPages(result.pagination?.totalPages || 1);
      }
    } catch (error) {
      console.error("Failed to load bookings:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-secondary-900">
            {user?.role === "PROVIDER" ? "Manage Bookings" : "My Bookings"}
          </h1>
          <p className="mt-1 text-secondary-600">
            {user?.role === "PROVIDER"
              ? "View and manage customer bookings"
              : "Track your service appointments"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={handleExportCsv}
            isLoading={exporting}
          >
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
          <Button variant="outline" onClick={handlePrint} isLoading={exporting}>
            <Printer className="mr-2 h-4 w-4" />
            Print
          </Button>
          {user?.role === "CUSTOMER" && (
            <Button asChild>
              <Link href="/search">Book New Service</Link>
            </Button>
          )}
        </div>
      </div>

      {/* Recurring series (customers only) */}
      {user?.role === "CUSTOMER" &&
        recurring.filter((s) => s.isActive).length > 0 && (
          <Card>
            <CardContent className="p-5">
              <div className="mb-3 flex items-center gap-2">
                <Repeat className="h-5 w-5 text-primary-600" />
                <h2 className="font-semibold text-secondary-900">
                  Recurring bookings
                </h2>
              </div>
              <div className="space-y-3">
                {recurring
                  .filter((s) => s.isActive)
                  .map((s) => (
                    <div
                      key={s.id}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-secondary-200 p-3"
                    >
                      <div className="text-sm">
                        <p className="font-medium text-secondary-900">
                          {s.provider?.user?.name ?? "Provider"} ·{" "}
                          {FREQUENCY_LABEL[s.frequency] ?? s.frequency}
                        </p>
                        <p className="text-secondary-500">
                          {s.occurrencesCreated} booked
                          {s.nextOccurrenceDate
                            ? ` · next ${formatDate(s.nextOccurrenceDate)}`
                            : ""}
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleStopSeries(s.id)}
                      >
                        Stop
                      </Button>
                    </div>
                  ))}
              </div>
            </CardContent>
          </Card>
        )}

      {/* Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {tabs.map((tab) => (
          <button
            key={tab.value}
            onClick={() => {
              setActiveTab(tab.value);
              setPage(1);
            }}
            className={cn(
              "whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium transition-colors",
              activeTab === tab.value
                ? "bg-primary-600 text-white"
                : "bg-secondary-100 text-secondary-600 hover:bg-secondary-200",
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Bookings List */}
      {isLoading ? (
        <div className="space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-5">
                <div className="flex items-start gap-4">
                  <Skeleton className="h-12 w-12 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-1/3" />
                    <Skeleton className="h-3 w-1/2" />
                    <div className="flex gap-2 pt-1">
                      <Skeleton className="h-5 w-20 rounded-full" />
                      <Skeleton className="h-5 w-16 rounded-full" />
                    </div>
                  </div>
                  <Skeleton className="h-9 w-24 rounded-lg" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : missingProviderProfile ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Calendar className="mx-auto h-16 w-16 text-secondary-300" />
            <h3 className="mt-4 text-lg font-medium text-secondary-900">
              Finish setting up your provider profile
            </h3>
            <p className="mt-2 text-secondary-500">
              You need to complete your provider profile before customers can
              book you and bookings can appear here.
            </p>
            <Button asChild className="mt-6">
              <Link href="/onboarding">Complete provider profile</Link>
            </Button>
          </CardContent>
        </Card>
      ) : bookings.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Calendar className="mx-auto h-16 w-16 text-secondary-300" />
            <h3 className="mt-4 text-lg font-medium text-secondary-900">
              No bookings found
            </h3>
            <p className="mt-2 text-secondary-500">
              {activeTab
                ? `You have no ${activeTab.toLowerCase()} bookings`
                : "You haven't made any bookings yet"}
            </p>
            {user?.role === "CUSTOMER" && (
              <Button asChild className="mt-6">
                <Link href="/search">Find a Service Provider</Link>
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {bookings.map((booking) => (
            <BookingCard
              key={booking.id}
              booking={booking}
              isProvider={user?.role === "PROVIDER"}
            />
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage(page - 1)}
            disabled={page === 1}
          >
            Previous
          </Button>
          <span className="text-sm text-secondary-600">
            Page {page} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage(page + 1)}
            disabled={page === totalPages}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}

function BookingCard({
  booking,
  isProvider,
}: {
  booking: Booking;
  isProvider: boolean;
}) {
  const otherUser = isProvider ? booking.customer : booking.provider?.user;
  const status = statusConfig[booking.status];

  // Whole card is no longer a Link — we render an explicit "View details"
  // button so the action is obvious. The card itself stays inert, which
  // also lets people select text / tap phone numbers without navigating
  // away by accident.
  return (
    <Card className="transition-shadow hover:shadow-soft-lg">
      <CardContent className="p-4 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-center gap-4">
            <Avatar
              size="lg"
              src={otherUser?.profileImage}
              name={otherUser?.name}
            />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-semibold text-secondary-900">
                  {otherUser?.name}
                </h3>
                <Badge variant={status.variant}>{status.label}</Badge>
              </div>
              <p className="mt-1 text-sm text-secondary-500">
                Booking #{booking.bookingNumber}
              </p>
            </div>
          </div>

          <div className="flex flex-col items-stretch gap-2 sm:items-end">
            {(booking.finalAmount || booking.estimatedAmount) && (
              <span className="text-lg font-bold text-primary-600">
                {formatCurrency(
                  Number(booking.finalAmount || booking.estimatedAmount),
                )}
              </span>
            )}
            <Button asChild size="sm" variant="outline">
              <Link href={`/bookings/${booking.id}`}>
                View details
                <ChevronRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-4 text-sm text-secondary-600">
          <div className="flex items-center gap-1.5">
            <Calendar className="h-4 w-4" />
            <span>{formatDate(booking.scheduledDate)}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Clock className="h-4 w-4" />
            <span>{formatTime(booking.scheduledStartTime)}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <MapPin className="h-4 w-4" />
            <span className="truncate">{booking.serviceAddress}</span>
          </div>
        </div>

        {booking.problemDescription && (
          <p className="mt-3 line-clamp-2 text-sm text-secondary-600">
            {booking.problemDescription}
          </p>
        )}

        {/* Action nudges so neither party forgets the next step. */}
        {!isProvider && booking.status === "COMPLETED" && !booking.review && (
          <Link
            href={`/bookings/${booking.id}`}
            className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-warning-50 px-3 py-1.5 text-sm font-semibold text-warning-700 hover:bg-warning-100"
          >
            <Star className="h-4 w-4 fill-warning-500 text-warning-500" />
            Leave a review
            <ChevronRight className="h-4 w-4" />
          </Link>
        )}
        {isProvider && booking.status === "IN_PROGRESS" && (
          <Link
            href={`/bookings/${booking.id}`}
            className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-primary-50 px-3 py-1.5 text-sm font-semibold text-primary-700 hover:bg-primary-100"
          >
            <CheckCircle className="h-4 w-4" />
            Mark as completed
            <ChevronRight className="h-4 w-4" />
          </Link>
        )}
      </CardContent>
    </Card>
  );
}
