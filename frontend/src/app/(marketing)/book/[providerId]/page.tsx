"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import {
  Calendar,
  Clock,
  MapPin,
  ChevronLeft,
  ChevronRight,
  Star,
  CheckCircle,
  Paperclip,
  X,
  FileText,
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
  filesService,
} from "@/lib/api";
import type { Provider, TimeSlot, ProviderService } from "@/types";
import { formatCurrency, formatDate, formatTime, cn } from "@/lib/utils";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// Slot startTime can arrive as a full ISO string ("1970-01-01T09:00:00.000Z")
// from Prisma. The backend DTO expects HH:MM:SS — extract it.
function extractHHMMSS(time: string): string {
  const match = time.match(/(\d{2}):(\d{2})(?::(\d{2}))?/);
  if (!match) return time;
  return `${match[1]}:${match[2]}:${match[3] ?? "00"}`;
}

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
  const [flexibleTime, setFlexibleTime] = useState(false);
  const [availableSlots, setAvailableSlots] = useState<TimeSlot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [serviceAddress, setServiceAddress] = useState("");
  const [problemDescription, setProblemDescription] = useState("");
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [attachments, setAttachments] = useState<
    {
      id: string;
      url: string;
      fileName: string;
      mimeType: string;
    }[]
  >([]);
  const [attachmentUploading, setAttachmentUploading] = useState(false);
  const [providerServices, setProviderServices] = useState<ProviderService[]>([]);
  const [selectedServiceId, setSelectedServiceId] = useState<string>("");

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
      const [data, services] = await Promise.all([
        providersService.getById(id),
        providersService.getProviderServices(id).catch(() => [] as ProviderService[]),
      ]);
      setProvider(data);
      setProviderServices(services.filter((s) => s.isActive));
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
      (!selectedSlot && !flexibleTime) ||
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
        scheduledStartTime:
          flexibleTime || !selectedSlot
            ? undefined
            : extractHHMMSS(selectedSlot.startTime),
        serviceAddress,
        problemDescription,
        attachmentIds: attachments.map((a) => a.id),
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
      <div className="flex min-h-screen flex-col items-center justify-center px-4">
        <h1 className="text-3xl font-bold text-secondary-900">
          Provider not found
        </h1>
        <p className="mt-4 text-lg text-secondary-600">
          We could not find this service provider.
        </p>
        <Button asChild className="mt-6" size="lg">
          <Link href="/search">Back to Search</Link>
        </Button>
      </div>
    );
  }

  const days = getDaysInMonth(currentMonth);

  return (
    <div className="min-h-screen bg-secondary-50 py-8">
      <div className="mx-auto max-w-4xl px-4 sm:px-8 lg:px-8">
        {/* Header */}
        <Link
          href={`/providers/${provider.id}`}
          className="mb-8 inline-flex items-center gap-2 text-base font-medium text-secondary-600 hover:text-secondary-900"
        >
          <ChevronLeft className="h-5 w-5" />
          Back to provider
        </Link>

        <h1 className="mb-8 text-3xl font-bold text-secondary-900">
          Book a Service
        </h1>

        {/* Progress Steps */}
        <div className="mb-8 flex items-center justify-center gap-2 sm:gap-4">
          {[1, 2, 3].map((s) => (
            <div key={s} className="flex items-center gap-2 sm:gap-3">
              <div
                className={cn(
                  "flex h-10 w-10 items-center justify-center rounded-full text-base font-bold sm:h-12 sm:w-12",
                  step >= s
                    ? "bg-primary-600 text-white"
                    : "bg-secondary-200 text-secondary-600",
                )}
              >
                {step > s ? <CheckCircle className="h-5 w-5 sm:h-6 sm:w-6" /> : s}
              </div>
              <span
                className={cn(
                  "hidden text-sm sm:inline sm:text-base",
                  step >= s
                    ? "font-bold text-secondary-900"
                    : "text-secondary-500",
                )}
              >
                {s === 1 ? "Select Date" : s === 2 ? "Choose Time" : "Details"}
              </span>
              {s < 3 && (
                <div
                  className={cn(
                    "h-0.5 w-6 sm:w-8",
                    step > s ? "bg-primary-600" : "bg-secondary-200",
                  )}
                />
              )}
            </div>
          ))}
        </div>

        {error && (
          <div className="mb-8 rounded-xl bg-error-50 p-6 text-base font-medium text-error-700">
            {error}
          </div>
        )}

        <div className="grid gap-8 lg:grid-cols-3">
          {/* Main Content */}
          <div className="lg:col-span-2">
            {step === 1 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-xl">
                    <Calendar className="h-6 w-6 text-primary-600" />
                    Select a Date
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {/* Calendar Navigation */}
                  <div className="mb-6 flex items-center justify-between">
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => navigateMonth("prev")}
                      aria-label="Previous month"
                    >
                      <ChevronLeft className="h-5 w-5" />
                    </Button>
                    <h3 className="text-lg font-bold text-secondary-900">
                      {currentMonth.toLocaleDateString("en-US", {
                        month: "long",
                        year: "numeric",
                      })}
                    </h3>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => navigateMonth("next")}
                      aria-label="Next month"
                    >
                      <ChevronRight className="h-5 w-5" />
                    </Button>
                  </div>

                  {/* Day Headers */}
                  <div className="mb-2 grid grid-cols-7 gap-1">
                    {DAYS.map((day) => (
                      <div
                        key={day}
                        className="py-2 text-center text-sm font-semibold text-secondary-500"
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
                            "flex min-h-[48px] items-center justify-center rounded-xl text-base font-medium transition-colors",
                            isDisabled
                              ? "cursor-not-allowed text-secondary-300"
                              : isSelected
                                ? "bg-primary-600 text-white"
                                : isToday
                                  ? "bg-primary-100 font-bold text-primary-700"
                                  : "text-secondary-900 hover:bg-secondary-100",
                          )}
                        >
                          {date.getDate()}
                        </button>
                      );
                    })}
                  </div>

                  <div className="mt-8 flex justify-end">
                    <Button size="lg" onClick={() => setStep(2)} disabled={!selectedDate}>
                      Continue
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {step === 2 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-xl">
                    <Clock className="h-6 w-6 text-primary-600" />
                    Choose a Time Slot
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="mb-6 text-base text-secondary-600">
                    Available times for{" "}
                    {selectedDate && formatDate(selectedDate.toISOString())}
                  </p>

                  {loadingSlots ? (
                    <div className="flex justify-center py-12">
                      <Spinner />
                    </div>
                  ) : availableSlots.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-secondary-200 p-8 text-center">
                      <Clock className="mx-auto h-12 w-12 text-secondary-300" />
                      <p className="mt-4 text-lg font-bold text-secondary-900">
                        No fixed time slots published for this date.
                      </p>
                      <p className="mt-2 text-base text-secondary-600">
                        You can request a flexible booking — the provider will
                        confirm the exact time with you via messaging.
                      </p>
                      <div className="mt-6 flex flex-wrap justify-center gap-4">
                        <Button
                          variant="outline"
                          size="lg"
                          onClick={() => setStep(1)}
                        >
                          Choose Another Date
                        </Button>
                        <Button
                          size="lg"
                          onClick={() => {
                            setFlexibleTime(true);
                            setSelectedSlot(null);
                            setStep(3);
                          }}
                        >
                          Request Flexible Time
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
                        {availableSlots.map((slot) => (
                          <button
                            key={slot.id}
                            onClick={() => {
                              setSelectedSlot(slot);
                              setFlexibleTime(false);
                            }}
                            className={cn(
                              "flex min-h-[48px] items-center justify-center rounded-xl border-2 px-4 py-3 text-base font-semibold transition-colors",
                              selectedSlot?.id === slot.id
                                ? "border-primary-600 bg-primary-50 text-primary-700"
                                : "border-secondary-200 text-secondary-700 hover:border-primary-300 hover:bg-primary-50",
                            )}
                          >
                            {formatTime(slot.startTime)}
                          </button>
                        ))}
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setFlexibleTime(true);
                          setSelectedSlot(null);
                        }}
                        className={cn(
                          "mt-4 flex min-h-[48px] w-full items-center justify-center rounded-xl border-2 px-4 py-3 text-base font-semibold transition-colors",
                          flexibleTime
                            ? "border-primary-600 bg-primary-50 text-primary-700"
                            : "border-dashed border-secondary-300 text-secondary-600 hover:border-primary-300 hover:bg-primary-50",
                        )}
                      >
                        I&apos;m flexible — let the provider confirm a time
                      </button>
                    </>
                  )}

                  <div className="mt-8 flex justify-between">
                    <Button variant="outline" size="lg" onClick={() => setStep(1)}>
                      Back
                    </Button>
                    <Button
                      size="lg"
                      onClick={() => setStep(3)}
                      disabled={!selectedSlot && !flexibleTime}
                    >
                      Continue
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {step === 3 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-xl">
                    <MapPin className="h-6 w-6 text-primary-600" />
                    Service Details
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  {providerServices.length > 0 && (
                    <div>
                      <label className="mb-2 block text-base font-semibold text-secondary-700">
                        Select a service{" "}
                        <span className="font-normal text-secondary-500">(optional)</span>
                      </label>
                      <div className="grid gap-2 sm:grid-cols-2">
                        {providerServices.map((svc) => (
                          <button
                            key={svc.id}
                            type="button"
                            onClick={() =>
                              setSelectedServiceId((prev) =>
                                prev === svc.id ? "" : svc.id,
                              )
                            }
                            className={cn(
                              "flex items-start justify-between rounded-xl border-2 px-4 py-3 text-left transition-colors",
                              selectedServiceId === svc.id
                                ? "border-primary-500 bg-primary-50"
                                : "border-secondary-200 bg-white hover:border-primary-300",
                            )}
                          >
                            <div className="min-w-0 flex-1 pr-3">
                              <p className="font-semibold text-secondary-900">
                                {svc.name}
                              </p>
                              {svc.durationMin > 0 && (
                                <p className="mt-0.5 flex items-center gap-1 text-sm text-secondary-500">
                                  <Clock className="h-3.5 w-3.5" />
                                  {svc.durationMin} min
                                </p>
                              )}
                            </div>
                            <p className="shrink-0 font-bold text-secondary-900">
                              GH₵ {Number(svc.basePrice).toFixed(2)}
                            </p>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="mb-2 block text-base font-semibold text-secondary-700">
                      Service Address *
                    </label>
                    <Input
                      value={serviceAddress}
                      onChange={(e) => setServiceAddress(e.target.value)}
                      placeholder="Enter your address"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-base font-semibold text-secondary-700">
                      Describe the issue or service needed *
                    </label>
                    <textarea
                      value={problemDescription}
                      onChange={(e) => setProblemDescription(e.target.value)}
                      rows={4}
                      className="w-full rounded-xl border-2 border-secondary-200 bg-white px-4 py-3 text-base text-secondary-900 placeholder:text-secondary-500 transition-all hover:border-secondary-300 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                      placeholder="Please describe what you need help with..."
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-base font-semibold text-secondary-700">
                      Photos or documents{" "}
                      <span className="font-normal text-secondary-500">
                        (optional, up to 10)
                      </span>
                    </label>
                    <p className="mb-3 text-sm text-secondary-500">
                      Attach photos of the issue or any reference documents to
                      help the provider prepare.
                    </p>
                    <div className="flex flex-wrap gap-3">
                      {attachments.map((a) => {
                        const isImage = (a.mimeType || "").startsWith("image/");
                        return (
                          <div
                            key={a.id}
                            className="relative h-24 w-24 overflow-hidden rounded-lg border border-secondary-200 bg-secondary-50"
                          >
                            {isImage ? (
                              <Image
                                src={a.url}
                                alt={a.fileName}
                                fill
                                sizes="96px"
                                className="object-cover"
                              />
                            ) : (
                              <div className="flex h-full w-full flex-col items-center justify-center px-1 text-center">
                                <FileText className="h-6 w-6 text-secondary-400" />
                                <span className="mt-1 truncate text-[10px] text-secondary-600">
                                  {a.fileName}
                                </span>
                              </div>
                            )}
                            <button
                              type="button"
                              onClick={() =>
                                setAttachments((prev) =>
                                  prev.filter((p) => p.id !== a.id),
                                )
                              }
                              className="absolute right-1 top-1 rounded-full bg-black/60 p-0.5 text-white"
                              aria-label="Remove attachment"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </div>
                        );
                      })}
                      {attachments.length < 10 && (
                        <label className="flex h-24 w-24 cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-secondary-300 text-secondary-500 hover:border-primary-400 hover:text-primary-600">
                          <input
                            type="file"
                            accept="image/*,application/pdf"
                            className="hidden"
                            onChange={async (e) => {
                              const file = e.target.files?.[0];
                              e.target.value = "";
                              if (!file) return;
                              setAttachmentUploading(true);
                              try {
                                const uploaded = await filesService.upload(
                                  file,
                                  "BOOKING",
                                );
                                setAttachments((prev) => [
                                  ...prev,
                                  {
                                    id: uploaded.id,
                                    url: uploaded.url,
                                    fileName: uploaded.fileName,
                                    mimeType: uploaded.mimeType,
                                  },
                                ]);
                              } catch (err) {
                                setError(
                                  err instanceof Error
                                    ? err.message
                                    : "Upload failed",
                                );
                              } finally {
                                setAttachmentUploading(false);
                              }
                            }}
                          />
                          {attachmentUploading ? (
                            <Spinner size="sm" />
                          ) : (
                            <>
                              <Paperclip className="h-5 w-5" />
                              <span className="mt-1 text-[11px] font-medium">
                                Add file
                              </span>
                            </>
                          )}
                        </label>
                      )}
                    </div>
                  </div>

                  <div className="mt-8 flex justify-between">
                    <Button variant="outline" size="lg" onClick={() => setStep(2)}>
                      Back
                    </Button>
                    <Button
                      size="lg"
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
          <div className="space-y-6">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <Avatar
                    size="lg"
                    src={provider.user.profileImage}
                    name={provider.user.name}
                    className="h-16 w-16"
                  />
                  <div>
                    <h3 className="text-lg font-bold text-secondary-900">
                      {provider.user.name}
                    </h3>
                    <div className="mt-1 flex items-center gap-2 text-base text-secondary-500">
                      <Star className="h-5 w-5 fill-warning-500 text-warning-500" />
                      <span className="font-semibold">{Number(provider.rating).toFixed(1)}</span>
                      <span>({provider.reviewCount} reviews)</span>
                    </div>
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {provider.categories.slice(0, 2).map((pc) => (
                    <Badge key={pc.id} variant="secondary" className="px-3 py-1.5 text-sm">
                      {pc.category.name}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Calendar className="h-5 w-5 text-primary-600" />
                  Booking Summary
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-base">
                {selectedDate && (
                  <div className="flex justify-between">
                    <span className="flex items-center gap-2 text-secondary-500">
                      <Calendar className="h-5 w-5" />
                      Date
                    </span>
                    <span className="font-bold text-secondary-900">
                      {formatDate(selectedDate.toISOString())}
                    </span>
                  </div>
                )}
                {selectedSlot && (
                  <div className="flex justify-between">
                    <span className="flex items-center gap-2 text-secondary-500">
                      <Clock className="h-5 w-5" />
                      Time
                    </span>
                    <span className="font-bold text-secondary-900">
                      {formatTime(selectedSlot.startTime)} - {formatTime(selectedSlot.endTime)}
                    </span>
                  </div>
                )}
                {flexibleTime && !selectedSlot && (
                  <div className="flex justify-between">
                    <span className="flex items-center gap-2 text-secondary-500">
                      <Clock className="h-5 w-5" />
                      Time
                    </span>
                    <span className="font-bold text-secondary-900">
                      Flexible (provider confirms)
                    </span>
                  </div>
                )}
                {selectedServiceId && (() => {
                  const svc = providerServices.find((s) => s.id === selectedServiceId);
                  return svc ? (
                    <div className="flex justify-between">
                      <span className="flex items-center gap-2 text-secondary-500">
                        <Star className="h-5 w-5" />
                        Service
                      </span>
                      <div className="text-right">
                        <p className="font-bold text-secondary-900">{svc.name}</p>
                        <p className="text-sm text-secondary-500">
                          GH₵ {Number(svc.basePrice).toFixed(2)}
                        </p>
                      </div>
                    </div>
                  ) : null;
                })()}
                <p className="border-t border-secondary-200 pt-4 text-sm text-secondary-500">
                  Final amount is agreed with the provider after the job and
                  paid offline.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
