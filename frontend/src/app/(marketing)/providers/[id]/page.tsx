"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  Star,
  MapPin,
  Clock,
  Calendar,
  MessageSquare,
  Phone,
  Mail,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { Spinner } from "@/components/ui/spinner";
import { providersService, availabilityService } from "@/lib/api";
import type { Provider, Review, Availability } from "@/types";
import { formatCurrency, formatRelativeTime, formatTime, cn } from "@/lib/utils";
import { useAuth } from "@/hooks";

// ─── Availability Tab ────────────────────────────────────────────────────────

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function ProviderAvailabilityTab({ provider }: { provider: Provider }) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [viewDate, setViewDate] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [availabilities, setAvailabilities] = useState<Availability[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  // Build a map of dateKey → availability for O(1) lookups
  const availMap = new Map(availabilities.map((a) => [a.date, a]));

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const firstDayOfMonth = new Date(year, month, 1).getDay(); // 0=Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  useEffect(() => {
    const start = new Date(year, month, 1).toISOString().split("T")[0] ?? "";
    const end = new Date(year, month + 1, 0).toISOString().split("T")[0] ?? "";
    setLoading(true);
    availabilityService
      .getProviderAvailability(provider.id, { startDate: start, endDate: end })
      .then(setAvailabilities)
      .catch(() => setAvailabilities([]))
      .finally(() => setLoading(false));
  }, [provider.id, year, month]);

  const prevMonth = () =>
    setViewDate(new Date(year, month - 1, 1));
  const nextMonth = () =>
    setViewDate(new Date(year, month + 1, 1));

  const selectedAvail = selectedDate ? availMap.get(selectedDate) : undefined;
  const availableSlots = selectedAvail?.timeSlots.filter((t) => t.isAvailable) ?? [];

  // Build calendar grid (prefix blank cells + day cells)
  const calendarCells: Array<{ day: number | null; dateKey: string | null }> = [
    ...Array.from({ length: firstDayOfMonth }, () => ({ day: null, dateKey: null })),
    ...Array.from({ length: daysInMonth }, (_, i) => {
      const d = i + 1;
      const dateKey = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      return { day: d, dateKey };
    }),
  ];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle>
              {MONTH_NAMES[month]} {year}
            </CardTitle>
            <div className="flex gap-1">
              <button
                onClick={prevMonth}
                disabled={viewDate <= new Date(today.getFullYear(), today.getMonth(), 1)}
                className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 disabled:opacity-30"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <button
                onClick={nextMonth}
                className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-10">
              <Spinner />
            </div>
          ) : (
            <>
              {/* Day headers */}
              <div className="mb-2 grid grid-cols-7 text-center">
                {WEEKDAYS.map((d) => (
                  <span key={d} className="py-1 text-xs font-semibold text-gray-400">
                    {d}
                  </span>
                ))}
              </div>

              {/* Day cells */}
              <div className="grid grid-cols-7 gap-1">
                {calendarCells.map((cell, idx) => {
                  if (!cell.day || !cell.dateKey) {
                    return <div key={idx} />;
                  }
                  const cellDate = new Date(year, month, cell.day);
                  const isPast = cellDate < today;
                  const avail = availMap.get(cell.dateKey);
                  const hasSlots =
                    avail?.isAvailable &&
                    avail.timeSlots.some((t) => t.isAvailable);
                  const isSelected = selectedDate === cell.dateKey;
                  const isToday =
                    cellDate.toDateString() === today.toDateString();

                  return (
                    <button
                      key={cell.dateKey}
                      disabled={isPast || !hasSlots}
                      onClick={() =>
                        setSelectedDate(isSelected ? null : cell.dateKey)
                      }
                      className={cn(
                        "relative flex flex-col items-center rounded-lg py-2 text-sm transition-all",
                        isSelected
                          ? "bg-primary-600 text-white"
                          : hasSlots && !isPast
                            ? "cursor-pointer hover:bg-primary-50 hover:text-primary-700"
                            : "cursor-default text-gray-300",
                        isToday && !isSelected && "font-bold text-primary-600",
                      )}
                    >
                      <span>{cell.day}</span>
                      {hasSlots && !isPast && (
                        <span
                          className={cn(
                            "mt-0.5 h-1.5 w-1.5 rounded-full",
                            isSelected ? "bg-white" : "bg-primary-500",
                          )}
                        />
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Legend */}
              <div className="mt-4 flex items-center gap-4 text-xs text-gray-500">
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-primary-500" />
                  Available
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-gray-200" />
                  Unavailable
                </span>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Time slots for selected date */}
      {selectedDate && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Available times on{" "}
              {new Date(selectedDate + "T00:00:00").toLocaleDateString("en-GH", {
                weekday: "long",
                month: "long",
                day: "numeric",
              })}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {availableSlots.length === 0 ? (
              <p className="text-sm text-gray-500">
                No available time slots for this day.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {availableSlots.map((slot) => (
                  <Link
                    key={slot.id}
                    href={`/book/${provider.id}?date=${selectedDate}&slot=${slot.startTime}`}
                  >
                    <span className="inline-flex items-center gap-1.5 rounded-lg border-2 border-primary-200 bg-primary-50 px-3 py-1.5 text-sm font-semibold text-primary-700 transition-all hover:border-primary-500 hover:bg-primary-100">
                      <Clock className="h-3.5 w-3.5" />
                      {formatTime(slot.startTime)}
                      {slot.endTime && ` – ${formatTime(slot.endTime)}`}
                    </span>
                  </Link>
                ))}
              </div>
            )}
            <div className="mt-4">
              <Button asChild>
                <Link href={`/book/${provider.id}`}>
                  <Calendar className="mr-2 h-4 w-4" />
                  Book this provider
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {availabilities.length === 0 && !loading && (
        <div className="rounded-xl border border-gray-200 bg-gray-50 p-6 text-center text-sm text-gray-500">
          This provider hasn&apos;t set their availability for this month yet.
          <div className="mt-3">
            <Button asChild variant="outline" size="sm">
              <Link href={`/book/${provider.id}`}>Book anyway</Link>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function ProviderDetailPage() {
  const params = useParams();
  const { user } = useAuth();
  const [provider, setProvider] = useState<Provider | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<
    "about" | "reviews" | "availability"
  >("about");

  useEffect(() => {
    if (params.id) {
      loadProvider(params.id as string);
    }
  }, [params.id]);

  const loadProvider = async (id: string) => {
    setIsLoading(true);
    try {
      const [providerData, reviewsData] = await Promise.all([
        providersService.getById(id),
        providersService.getReviews(id),
      ]);
      setProvider(providerData);
      setReviews(reviewsData.data || []);
    } catch (error) {
      console.error("Failed to load provider:", error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!provider) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center">
        <h1 className="text-2xl font-bold text-secondary-900">
          Provider not found
        </h1>
        <p className="mt-2 text-secondary-600">
          The provider you are looking for does not exist.
        </p>
        <Button asChild className="mt-4">
          <Link href="/search">Back to Search</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-secondary-50">
      <div className="bg-white shadow-sm">
        <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
          <Link
            href="/search"
            className="mb-4 inline-flex items-center text-sm text-secondary-600 hover:text-secondary-900"
          >
            <ChevronLeft className="mr-1 h-4 w-4" />
            Back to search
          </Link>

          <div className="flex flex-col gap-6 sm:flex-row">
            <Avatar
              size="2xl"
              src={provider.user.profileImage}
              name={provider.user.name}
            />
            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-bold text-secondary-900">
                  {provider.user.name}
                </h1>
                {provider.verificationStatus === "VERIFIED" && (
                  <Badge variant="success">
                    <CheckCircle className="mr-1 h-3 w-3" />
                    Verified
                  </Badge>
                )}
              </div>

              <div className="mt-2 flex flex-wrap gap-2">
                {provider.categories.map((pc) => (
                  <Badge key={pc.id} variant="secondary">
                    {pc.category.name}
                  </Badge>
                ))}
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-4 text-sm text-secondary-600">
                <div className="flex items-center gap-1">
                  <Star className="h-4 w-4 fill-warning-500 text-warning-500" />
                  <span className="font-semibold text-secondary-900">
                    {Number(provider.rating).toFixed(1)}
                  </span>
                  <span>({provider.reviewCount} reviews)</span>
                </div>
                <div className="flex items-center gap-1">
                  <MapPin className="h-4 w-4" />
                  <span>{provider.location}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Clock className="h-4 w-4" />
                  <span>{provider.yearsExperience} years experience</span>
                </div>
              </div>

              <div className="mt-4 flex items-center gap-4">
                <div>
                  <span className="text-2xl font-bold text-primary-600">
                    {formatCurrency(Number(provider.hourlyRate))}
                  </span>
                  <span className="text-secondary-500">/hour</span>
                </div>
                {user?.role === "CUSTOMER" && (
                  <Button asChild>
                    <Link href={`/book/${provider.id}`}>
                      <Calendar className="mr-2 h-4 w-4" />
                      Book Now
                    </Link>
                  </Button>
                )}
                <Button variant="outline">
                  <MessageSquare className="mr-2 h-4 w-4" />
                  Message
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="border-b bg-white">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <nav className="flex gap-8">
            {(["about", "reviews", "availability"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`border-b-2 py-4 text-sm font-medium transition-colors ${
                  activeTab === tab
                    ? "border-primary-600 text-primary-600"
                    : "border-transparent text-secondary-600 hover:text-secondary-900"
                }`}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </nav>
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        {activeTab === "about" && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>About</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-secondary-700">
                  {provider.bio || "No description available."}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Contact Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {provider.user.email && (
                  <div className="flex items-center gap-3">
                    <Mail className="h-5 w-5 text-secondary-400" />
                    <span className="text-secondary-700">
                      {provider.user.email}
                    </span>
                  </div>
                )}
                {provider.user.phone && (
                  <div className="flex items-center gap-3">
                    <Phone className="h-5 w-5 text-secondary-400" />
                    <span className="text-secondary-700">
                      {provider.user.phone}
                    </span>
                  </div>
                )}
                <div className="flex items-center gap-3">
                  <MapPin className="h-5 w-5 text-secondary-400" />
                  <span className="text-secondary-700">
                    {provider.location}
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {activeTab === "reviews" && (
          <div className="space-y-4">
            {reviews.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Star className="mx-auto h-12 w-12 text-secondary-300" />
                  <p className="mt-4 text-secondary-600">No reviews yet</p>
                </CardContent>
              </Card>
            ) : (
              reviews.map((review) => (
                <Card key={review.id}>
                  <CardContent className="p-6">
                    <div className="flex items-start gap-4">
                      <Avatar
                        src={review.customer?.profileImage}
                        name={review.customer?.name}
                      />
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <h4 className="font-medium text-secondary-900">
                            {review.customer?.name}
                          </h4>
                          <span className="text-sm text-secondary-500">
                            {formatRelativeTime(review.createdAt)}
                          </span>
                        </div>
                        <div className="mt-1 flex items-center gap-1">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <Star
                              key={i}
                              className={`h-4 w-4 ${
                                i < review.rating
                                  ? "fill-warning-500 text-warning-500"
                                  : "fill-secondary-200 text-secondary-200"
                              }`}
                            />
                          ))}
                        </div>
                        {review.comment && (
                          <p className="mt-3 text-secondary-700">
                            {review.comment}
                          </p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        )}

        {activeTab === "availability" && (
          <ProviderAvailabilityTab provider={provider} />
        )}
      </div>
    </div>
  );
}
