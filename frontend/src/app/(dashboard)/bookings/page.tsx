"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Calendar,
  Clock,
  MapPin,
  Filter,
  Search,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { Spinner } from "@/components/ui/spinner";
import { useAuth } from "@/hooks";
import { bookingsService, providersService } from "@/lib/api";
import type { Booking, BookingStatus } from "@/types";
import { formatDate, formatTime, formatCurrency, cn } from "@/lib/utils";

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

  useEffect(() => {
    loadBookings();
  }, [user, activeTab, page]);

  const loadBookings = async () => {
    if (!user) return;

    setIsLoading(true);
    try {
      const getProviderId = async () => {
        if (providerId) return providerId;
        const provider = await providersService.getMyProfile();
        setProviderId(provider.id);
        return provider.id;
      };

      const result =
        user.role === "PROVIDER"
          ? await bookingsService.getProviderBookings(await getProviderId(), {
              status: (activeTab as BookingStatus) || undefined,
              page,
              limit: 10,
            })
          : await bookingsService.getCustomerBookings({
              status: (activeTab as BookingStatus) || undefined,
              page,
              limit: 10,
            });

      setBookings(result.data || []);
      setTotalPages(result.pagination?.totalPages || 1);
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
        {user?.role === "CUSTOMER" && (
          <Button asChild>
            <Link href="/search">Book New Service</Link>
          </Button>
        )}
      </div>

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
        <div className="flex items-center justify-center py-20">
          <Spinner size="lg" />
        </div>
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

  return (
    <Link href={`/bookings/${booking.id}`}>
      <Card className="transition-all hover:-translate-y-0.5 hover:shadow-soft-lg">
        <CardContent className="p-4 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <Avatar
                size="lg"
                src={otherUser?.profileImage}
                name={otherUser?.name}
              />
              <div>
                <div className="flex items-center gap-2">
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

            <div className="flex items-center gap-2">
              {booking.finalAmount || booking.estimatedAmount ? (
                <span className="text-lg font-bold text-primary-600">
                  {formatCurrency(
                    Number(booking.finalAmount || booking.estimatedAmount),
                  )}
                </span>
              ) : null}
              <ChevronRight className="h-5 w-5 text-secondary-400" />
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
        </CardContent>
      </Card>
    </Link>
  );
}
