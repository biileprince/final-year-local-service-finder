"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  Calendar,
  Clock,
  MapPin,
  ChevronLeft,
  ChevronRight,
  Star,
  CheckCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { useAuth, useRequireAuth } from "@/hooks";
import {
  providersService,
  availabilityService,
  bookingsService,
} from "@/lib/api";
import type { Provider, TimeSlot } from "@/types";
import { formatCurrency, formatDate, cn } from "@/lib/utils";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function BookProviderPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useRequireAuth();
  const [provider, setProvider] = useState<Provider | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isBooking, setIsBooking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Booking state
  const [step, setStep] = useState(1);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null);
  const [availableSlots, setAvailableSlots] = useState<TimeSlot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [serviceAddress, setServiceAddress] = useState("");
  const [problemDescription, setProblemDescription] = useState("");
  const [currentMonth, setCurrentMonth] = useState(new Date());

  useEffect(() => {
    if (params.providerId) {
      loadProvider(params.providerId as string);
    }
  }, [params.providerId]);

  useEffect(() => {
    if (selectedDate && provider) {
      loadTimeSlots();
    }
  }, [selectedDate, provider]);

  const loadProvider = async (id: string) => {
    setIsLoading(true);
    try {
      const data = await providersService.getById(id);
      setProvider(data);
    } catch (error) {
      console.error("Failed to load provider:", error);
      setError("Failed to load provider");
    } finally {
      setIsLoading(false);
    }
  };

  const loadTimeSlots = async () => {
    if (!selectedDate || !provider) return;

    setLoadingSlots(true);
    try {
      const dateStr = selectedDate.toISOString().split("T")[0] ?? "";
      const slots = await availabilityService.getAvailableSlots(
        provider.id,
        dateStr,
      );
      setAvailableSlots(slots);
    } catch (error) {
      console.error("Failed to load time slots:", error);
      setAvailableSlots([]);
    } finally {
      setLoadingSlots(false);
    }
  };

  const handleBooking = async () => {
    if (
      !provider ||
      !selectedDate ||
      !selectedSlot ||
      !serviceAddress ||
      !problemDescription
    ) {
      return;
    }

    setIsBooking(true);
    setError(null);

    try {
      const booking = await bookingsService.create({
        providerId: provider.id,
        scheduledDate: selectedDate.toISOString().split("T")[0] ?? "",
        scheduledStartTime: selectedSlot.startTime,
        serviceAddress,
        problemDescription,
      });

      router.push(`/bookings/${booking.id}?success=true`);
    } catch (error: any) {
      console.error("Failed to create booking:", error);
      setError(error.message || "Failed to create booking. Please try again.");
    } finally {
      setIsBooking(false);
    }
  };

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const days: (Date | null)[] = [];

    // Add empty slots for days before the first day
    for (let i = 0; i < firstDay.getDay(); i++) {
      days.push(null);
    }

    // Add actual days
    for (let i = 1; i <= lastDay.getDate(); i++) {
      days.push(new Date(year, month, i));
    }

    return days;
  };

  const isDateDisabled = (date: Date) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return date < today;
  };

  const navigateMonth = (direction: "prev" | "next") => {
    setCurrentMonth((prev) => {
      const newMonth = new Date(prev);
      newMonth.setMonth(prev.getMonth() + (direction === "next" ? 1 : -1));
      return newMonth;
    });
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
        <Button asChild className="mt-4">
          <Link href="/search">Back to Search</Link>
        </Button>
      </div>
    );
  }

  const days = getDaysInMonth(currentMonth);

  return (
    <div className="min-h-screen bg-secondary-50 py-8">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <Link
          href={`/providers/${provider.id}`}
          className="mb-6 inline-flex items-center text-sm text-secondary-600 hover:text-secondary-900"
        >
          <ChevronLeft className="mr-1 h-4 w-4" />
          Back to provider
        </Link>

        <h1 className="mb-8 text-2xl font-bold text-secondary-900">
          Book a Service
        </h1>

        {/* Progress Steps */}
        <div className="mb-8 flex items-center justify-center gap-4">
          {[1, 2, 3].map((s) => (
            <div key={s} className="flex items-center gap-2">
              <div
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium",
                  step >= s
                    ? "bg-primary-600 text-white"
                    : "bg-secondary-200 text-secondary-600",
                )}
              >
                {step > s ? <CheckCircle className="h-5 w-5" /> : s}
              </div>
              <span
                className={cn(
                  "text-sm",
                  step >= s
                    ? "font-medium text-secondary-900"
                    : "text-secondary-500",
                )}
              >
                {s === 1 ? "Select Date" : s === 2 ? "Choose Time" : "Details"}
              </span>
              {s < 3 && (
                <div
                  className={cn(
                    "h-0.5 w-8",
                    step > s ? "bg-primary-600" : "bg-secondary-200",
                  )}
                />
              )}
            </div>
          ))}
        </div>

        {error && (
          <div className="mb-6 rounded-lg bg-error-50 p-4 text-error-700">
            {error}
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Main Content */}
          <div className="lg:col-span-2">
            {step === 1 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Calendar className="h-5 w-5" />
                    Select a Date
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {/* Calendar Navigation */}
                  <div className="mb-4 flex items-center justify-between">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => navigateMonth("prev")}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <h3 className="font-semibold text-secondary-900">
                      {currentMonth.toLocaleDateString("en-US", {
                        month: "long",
                        year: "numeric",
                      })}
                    </h3>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => navigateMonth("next")}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>

                  {/* Day Headers */}
                  <div className="mb-2 grid grid-cols-7 gap-1">
                    {DAYS.map((day) => (
                      <div
                        key={day}
                        className="py-2 text-center text-xs font-medium text-secondary-500"
                      >
                        {day}
                      </div>
                    ))}
                  </div>

                  {/* Calendar Grid */}
                  <div className="grid grid-cols-7 gap-1">
                    {days.map((date, index) => {
                      if (!date) {
                        return <div key={`empty-${index}`} className="p-2" />;
                      }

                      const isDisabled = isDateDisabled(date);
                      const isSelected =
                        selectedDate?.toDateString() === date.toDateString();
                      const isToday =
                        new Date().toDateString() === date.toDateString();

                      return (
                        <button
                          key={date.toISOString()}
                          onClick={() => !isDisabled && setSelectedDate(date)}
                          disabled={isDisabled}
                          className={cn(
                            "rounded-lg p-2 text-sm transition-colors",
                            isDisabled
                              ? "cursor-not-allowed text-secondary-300"
                              : isSelected
                                ? "bg-primary-600 text-white"
                                : isToday
                                  ? "bg-primary-100 text-primary-700"
                                  : "text-secondary-900 hover:bg-secondary-100",
                          )}
                        >
                          {date.getDate()}
                        </button>
                      );
                    })}
                  </div>

                  <div className="mt-6 flex justify-end">
                    <Button onClick={() => setStep(2)} disabled={!selectedDate}>
                      Continue
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {step === 2 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="h-5 w-5" />
                    Choose a Time Slot
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="mb-4 text-secondary-600">
                    Available times for{" "}
                    {selectedDate && formatDate(selectedDate.toISOString())}
                  </p>

                  {loadingSlots ? (
                    <div className="flex justify-center py-8">
                      <Spinner />
                    </div>
                  ) : availableSlots.length === 0 ? (
                    <div className="py-8 text-center">
                      <Clock className="mx-auto h-12 w-12 text-secondary-300" />
                      <p className="mt-4 text-secondary-600">
                        No available time slots for this date.
                      </p>
                      <Button
                        variant="outline"
                        onClick={() => setStep(1)}
                        className="mt-4"
                      >
                        Choose Another Date
                      </Button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                      {availableSlots.map((slot) => (
                        <button
                          key={slot.id}
                          onClick={() => setSelectedSlot(slot)}
                          className={cn(
                            "rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
                            selectedSlot?.id === slot.id
                              ? "border-primary-600 bg-primary-50 text-primary-700"
                              : "border-secondary-200 text-secondary-700 hover:border-primary-300 hover:bg-primary-50",
                          )}
                        >
                          {slot.startTime}
                        </button>
                      ))}
                    </div>
                  )}

                  <div className="mt-6 flex justify-between">
                    <Button variant="outline" onClick={() => setStep(1)}>
                      Back
                    </Button>
                    <Button onClick={() => setStep(3)} disabled={!selectedSlot}>
                      Continue
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {step === 3 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MapPin className="h-5 w-5" />
                    Service Details
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-secondary-700">
                      Service Address *
                    </label>
                    <Input
                      value={serviceAddress}
                      onChange={(e) => setServiceAddress(e.target.value)}
                      placeholder="Enter your address"
                    />
                  </div>

                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-secondary-700">
                      Describe the issue or service needed *
                    </label>
                    <textarea
                      value={problemDescription}
                      onChange={(e) => setProblemDescription(e.target.value)}
                      rows={4}
                      className="w-full rounded-lg border border-secondary-300 px-3 py-2 text-secondary-900 placeholder:text-secondary-400 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                      placeholder="Please describe what you need help with..."
                    />
                  </div>

                  <div className="mt-6 flex justify-between">
                    <Button variant="outline" onClick={() => setStep(2)}>
                      Back
                    </Button>
                    <Button
                      onClick={handleBooking}
                      disabled={!serviceAddress || !problemDescription}
                      isLoading={isBooking}
                    >
                      Confirm Booking
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Sidebar - Provider Info */}
          <div className="space-y-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <Avatar
                    size="lg"
                    src={provider.user.profileImage}
                    name={provider.user.name}
                  />
                  <div>
                    <h3 className="font-semibold text-secondary-900">
                      {provider.user.name}
                    </h3>
                    <div className="flex items-center gap-1 text-sm text-secondary-500">
                      <Star className="h-4 w-4 fill-warning-500 text-warning-500" />
                      <span>{Number(provider.rating).toFixed(1)}</span>
                      <span>({provider.reviewCount} reviews)</span>
                    </div>
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {provider.categories.slice(0, 2).map((pc) => (
                    <Badge key={pc.id} variant="secondary">
                      {pc.category.name}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Booking Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {selectedDate && (
                  <div className="flex justify-between">
                    <span className="text-secondary-500">Date</span>
                    <span className="font-medium text-secondary-900">
                      {formatDate(selectedDate.toISOString())}
                    </span>
                  </div>
                )}
                {selectedSlot && (
                  <div className="flex justify-between">
                    <span className="text-secondary-500">Time</span>
                    <span className="font-medium text-secondary-900">
                      {selectedSlot.startTime} - {selectedSlot.endTime}
                    </span>
                  </div>
                )}
                <div className="flex justify-between border-t pt-2">
                  <span className="text-secondary-500">Hourly Rate</span>
                  <span className="font-bold text-primary-600">
                    {formatCurrency(Number(provider.hourlyRate))}
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
