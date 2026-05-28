"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import {
  Star,
  MapPin,
  Clock,
  Calendar,
  MessageSquare,
  Phone,
  Mail,
  Lock,
  ExternalLink,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Briefcase,
  Award,
  ImageIcon,
  DollarSign,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { Spinner } from "@/components/ui/spinner";
import { useRouter } from "next/navigation";
import {
  providersService,
  availabilityService,
  messagesService,
  bookingsService,
} from "@/lib/api";
import type { Provider, Review, Availability, ProviderService } from "@/types";
import { formatRelativeTime, formatTime, cn } from "@/lib/utils";
import { useAuth } from "@/hooks";
import { ReviewCard } from "@/components/reviews/review-card";
import { ProvidersMap } from "@/components/providers/providers-map";
import { FavoriteButton } from "@/components/providers/favorite-button";
import { queryPermission } from "@/lib/permissions";

// ─── Work Gallery + Lightbox ─────────────────────────────────────────────────

function GalleryLightbox({
  gallery,
}: {
  gallery: NonNullable<Provider["gallery"]>;
}) {
  const [openIdx, setOpenIdx] = useState<number | null>(null);
  const count = gallery.length;

  const close = useCallback(() => setOpenIdx(null), []);
  const go = useCallback(
    (delta: number) =>
      setOpenIdx((cur) => (cur === null ? cur : (cur + delta + count) % count)),
    [count],
  );

  // While the lightbox is open: arrow keys navigate, Escape closes, and we
  // lock body scroll so the page behind doesn't move.
  useEffect(() => {
    if (openIdx === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      else if (e.key === "ArrowRight") go(1);
      else if (e.key === "ArrowLeft") go(-1);
    };
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [openIdx, close, go]);

  const active = openIdx === null ? null : gallery[openIdx];

  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {gallery.map((g, idx) => (
          <button
            key={g.id}
            type="button"
            onClick={() => setOpenIdx(idx)}
            aria-label={g.title ? `Expand ${g.title}` : "Expand image"}
            className="group relative block aspect-square overflow-hidden rounded-xl bg-secondary-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2"
          >
            <Image
              src={g.file.thumbnailUrl || g.file.url}
              alt={g.title || "Gallery item"}
              fill
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 300px"
              className="object-cover transition-transform duration-200 group-hover:scale-105"
            />
            {g.title && (
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-3 text-left text-sm font-semibold text-white">
                {g.title}
              </div>
            )}
          </button>
        ))}
      </div>

      {active && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 p-4 sm:p-8"
          onClick={close}
          role="dialog"
          aria-modal="true"
          aria-label="Image viewer"
        >
          <button
            type="button"
            onClick={close}
            className="absolute right-4 top-4 z-10 rounded-full bg-white/10 p-2 text-white transition-colors hover:bg-white/25"
            aria-label="Close"
          >
            <X className="h-6 w-6" />
          </button>

          {count > 1 && (
            <>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  go(-1);
                }}
                className="absolute left-2 top-1/2 z-10 -translate-y-1/2 rounded-full bg-white/10 p-2 text-white transition-colors hover:bg-white/25 sm:left-4"
                aria-label="Previous image"
              >
                <ChevronLeft className="h-7 w-7" />
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  go(1);
                }}
                className="absolute right-2 top-1/2 z-10 -translate-y-1/2 rounded-full bg-white/10 p-2 text-white transition-colors hover:bg-white/25 sm:right-4"
                aria-label="Next image"
              >
                <ChevronRight className="h-7 w-7" />
              </button>
            </>
          )}

          <div
            className="relative h-[80vh] w-full max-w-5xl"
            onClick={(e) => e.stopPropagation()}
          >
            <Image
              src={active.file.url}
              alt={active.title || "Gallery image"}
              fill
              sizes="100vw"
              className="object-contain"
              priority
            />
          </div>

          {(active.title || count > 1) && (
            <div className="pointer-events-none absolute bottom-4 left-0 right-0 text-center text-sm text-white/90">
              {active.title && <span className="font-medium">{active.title}</span>}
              {count > 1 && (
                <span className="ml-2 text-white/60">
                  {openIdx! + 1} / {count}
                </span>
              )}
            </div>
          )}
        </div>
      )}
    </>
  );
}

// ─── Availability Section ────────────────────────────────────────────────────

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function ProviderAvailabilitySection({ provider }: { provider: Provider }) {
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
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-primary-600" />
              {MONTH_NAMES[month]} {year}
            </CardTitle>
            <div className="flex gap-2">
              <button
                onClick={prevMonth}
                disabled={viewDate <= new Date(today.getFullYear(), today.getMonth(), 1)}
                className="flex h-11 w-11 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 disabled:opacity-30"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <button
                onClick={nextMonth}
                className="flex h-11 w-11 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-12">
              <Spinner />
            </div>
          ) : (
            <>
              {/* Day headers */}
              <div className="mb-2 grid grid-cols-7 text-center">
                {WEEKDAYS.map((d) => (
                  <span key={d} className="py-2 text-sm font-semibold text-gray-500">
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
                        "relative flex min-h-[48px] flex-col items-center justify-center rounded-lg py-2 text-base transition-all",
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
              <div className="mt-6 flex items-center gap-6 text-sm text-gray-500">
                <span className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-primary-500" />
                  Available
                </span>
                <span className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-gray-200" />
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
            <CardTitle className="flex items-center gap-2 text-lg">
              <Clock className="h-5 w-5 text-primary-600" />
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
              <p className="text-base text-gray-500">
                No available time slots for this day.
              </p>
            ) : (
              <div className="flex flex-wrap gap-4">
                {availableSlots.map((slot) => (
                  <Link
                    key={slot.id}
                    href={`/book/${provider.id}?date=${selectedDate}&slot=${slot.startTime}`}
                  >
                    <span className="inline-flex min-h-[48px] items-center gap-2 rounded-xl border-2 border-primary-200 bg-primary-50 px-4 py-3 text-base font-semibold text-primary-700 transition-all hover:border-primary-500 hover:bg-primary-100">
                      <Clock className="h-4 w-4" />
                      {formatTime(slot.startTime)}
                      {slot.endTime && ` – ${formatTime(slot.endTime)}`}
                    </span>
                  </Link>
                ))}
              </div>
            )}
            <div className="mt-6">
              <Button size="lg" asChild>
                <Link href={`/book/${provider.id}`}>
                  <Calendar className="mr-2 h-5 w-5" />
                  Book this provider
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {availabilities.length === 0 && !loading && (
        <div className="rounded-xl border border-gray-200 bg-gray-50 p-8 text-center text-base text-gray-500">
          This provider hasn&apos;t set their availability for this month yet.
          <div className="mt-4">
            <Button asChild variant="outline" size="lg">
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
  const router = useRouter();
  const { user } = useAuth();
  const [messaging, setMessaging] = useState(false);

  const handleMessage = async (providerId: string) => {
    if (!user) {
      router.push("/login");
      return;
    }
    if (user.role !== "CUSTOMER") return;
    setMessaging(true);
    try {
      const conv = await messagesService.startConversation(providerId);
      router.push(`/messages/${conv.id}`);
    } catch {
      setMessaging(false);
    }
  };
  const [provider, setProvider] = useState<Provider | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [providerServices, setProviderServices] = useState<ProviderService[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [suggested, setSuggested] = useState<Provider[]>([]);
  // Contact (email/phone) is gated behind a booking — customers only see it
  // once they've actually engaged the provider. Cancelled bookings still count
  // (they exchanged info during the booking flow).
  const [hasBooked, setHasBooked] = useState(false);

  useEffect(() => {
    if (params.id) {
      loadProvider(params.id as string);
    }
  }, [params.id]);

  const loadProvider = async (id: string) => {
    setIsLoading(true);
    try {
      // Try ID first; if not found, fall back to slug. Some links may use
      // either form; this avoids dead-ends caused by stale URLs.
      let providerData: Provider | null = null;
      try {
        providerData = await providersService.getById(id);
      } catch {
        try {
          providerData = await providersService.getBySlug(id);
        } catch {
          providerData = null;
        }
      }

      if (!providerData) {
        // Show useful alternatives instead of a dead-end page
        try {
          const top = await providersService.getTopRated(6);
          setSuggested(top);
        } catch {
          /* ignore */
        }
        setProvider(null);
        return;
      }

      setProvider(providerData);
      const [reviewsData, servicesData] = await Promise.allSettled([
        providersService.getReviews(providerData.id),
        providersService.getProviderServices(providerData.id),
      ]);
      setReviews(reviewsData.status === "fulfilled" ? (reviewsData.value.data ?? []) : []);
      setProviderServices(servicesData.status === "fulfilled" ? servicesData.value : []);
    } finally {
      setIsLoading(false);
    }
  };

  // Check whether the signed-in customer has any booking history with this
  // provider. Runs after provider is loaded so we don't keep contact details
  // permanently locked while the page is still resolving.
  useEffect(() => {
    if (!provider || !user || user.role !== "CUSTOMER") {
      setHasBooked(false);
      return;
    }
    let cancelled = false;
    bookingsService
      .getCustomerBookings({ limit: 100 })
      .then((res) => {
        if (cancelled) return;
        setHasBooked(res.data.some((b) => b.providerId === provider.id));
      })
      .catch(() => {
        if (!cancelled) setHasBooked(false);
      });
    return () => {
      cancelled = true;
    };
  }, [provider, user]);

  // The provider sees their own contact regardless; staff/admin always; everyone
  // else (customers + visitors) must have a booking with this provider.
  const canSeeContact =
    user?.role === "ADMIN" ||
    (user?.role === "PROVIDER" && user?.id === provider?.user?.id) ||
    hasBooked;

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!provider) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-16 sm:px-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-secondary-900">
            Provider not found
          </h1>
          <p className="mt-4 text-lg text-secondary-600">
            This provider may no longer be available. Try one of the top-rated
            providers below.
          </p>
          <div className="mt-6 flex justify-center gap-4">
            <Button asChild variant="outline" size="lg">
              <Link href="/search">Browse all providers</Link>
            </Button>
          </div>
        </div>

        {suggested.length > 0 && (
          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {suggested.map((p) => (
              <Link
                key={p.id}
                href={`/providers/${p.id}`}
                className="group flex items-center gap-4 rounded-2xl border border-secondary-100 bg-white p-6 transition-shadow hover:shadow-md"
              >
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary-100 text-xl font-bold text-primary-700">
                  {p.user.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1">
                  <p className="text-lg font-bold text-secondary-900 group-hover:text-primary-700">
                    {p.user.name}
                  </p>
                  <p className="text-sm text-secondary-500">
                    <MapPin className="mr-1 inline h-4 w-4" />
                    {p.location} · <Star className="mr-1 inline h-4 w-4 fill-amber-400 text-amber-400" />
                    {Number(p.rating).toFixed(1)}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-secondary-50">
      {/* ====== Provider Header ====== */}
      <div className="bg-white shadow-sm">
        <div className="mx-auto max-w-6xl px-4 py-8 sm:px-8 lg:px-8">
          <Link
            href="/search"
            className="mb-6 inline-flex items-center gap-2 text-base font-medium text-secondary-600 hover:text-secondary-900"
          >
            <ChevronLeft className="h-5 w-5" />
            Back to search
          </Link>

          <div className="flex flex-col gap-8 sm:flex-row">
            <Avatar
              size="2xl"
              src={provider.user.profileImage}
              name={provider.user.name}
              sizes="(max-width: 640px) 144px, 192px"
              className="h-36 w-36 shrink-0 rounded-2xl object-cover shadow-md ring-1 ring-secondary-100 sm:h-48 sm:w-48"
            />
            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-4">
                <h1 className="text-3xl font-bold text-secondary-900">
                  {provider.user.name}
                </h1>
                {provider.verificationStatus === "VERIFIED" && (
                  <Badge variant="success" className="gap-1 px-3 py-1.5 text-sm">
                    <CheckCircle className="h-4 w-4" />
                    Verified
                  </Badge>
                )}
                <FavoriteButton
                  providerId={provider.id}
                  variant="inline"
                  stopPropagation={false}
                />
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {provider.categories.map((pc) => (
                  <Badge key={pc.id} variant="secondary" className="px-3 py-1.5 text-sm">
                    {pc.category.name}
                  </Badge>
                ))}
              </div>

              {/* Key info with icons — flattened for non-literate users */}
              <div className="mt-6 flex flex-wrap items-center gap-6 text-base text-secondary-600">
                <div className="flex items-center gap-2">
                  <Star className="h-5 w-5 fill-warning-500 text-warning-500" />
                  <span className="font-bold text-secondary-900">
                    {Number(provider.rating).toFixed(1)}
                  </span>
                  <span>({provider.reviewCount} reviews)</span>
                </div>
                <div className="flex items-center gap-2">
                  <MapPin className="h-5 w-5 text-primary-600" />
                  <span>{provider.location}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="h-5 w-5 text-primary-600" />
                  <span>{provider.yearsExperience} years experience</span>
                </div>
              </div>

              <div className="mt-6 flex flex-wrap items-center gap-4">
                {user?.role === "CUSTOMER" && (
                  <Button size="lg" asChild>
                    <Link href={`/book/${provider.id}`}>
                      <Calendar className="mr-2 h-5 w-5" />
                      Book Now
                    </Link>
                  </Button>
                )}
                {(!user || user.role === "CUSTOMER") && (
                  <Button
                    variant="outline"
                    size="lg"
                    onClick={() => handleMessage(provider.id)}
                    isLoading={messaging}
                  >
                    <MessageSquare className="mr-2 h-5 w-5" />
                    Message
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ====== Main Content — Flat layout, no tabs ====== */}
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-8 lg:px-8">
        <div className="grid gap-8 lg:grid-cols-[1fr_380px]">
          {/* Left Column: Info */}
          <div className="space-y-8">
            {/* Track record stats */}
            <div className="grid gap-4 sm:grid-cols-3">
              <Card>
                <CardContent className="flex items-center gap-4 p-6">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary-100">
                    <Award className="h-6 w-6 text-primary-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-secondary-900">
                      {provider.completedBookings}
                    </p>
                    <p className="text-sm text-secondary-500">Jobs completed</p>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="flex items-center gap-4 p-6">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-warning-50">
                    <Star className="h-6 w-6 text-warning-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-secondary-900">
                      {Number(provider.rating).toFixed(1)}
                    </p>
                    <p className="text-sm text-secondary-500">
                      from {provider.reviewCount} reviews
                    </p>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="flex items-center gap-4 p-6">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-secondary-100">
                    <Briefcase className="h-6 w-6 text-secondary-700" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-secondary-900">
                      {provider.yearsExperience}+
                    </p>
                    <p className="text-sm text-secondary-500">
                      Years experience
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* About */}
            <Card>
              <CardHeader>
                <CardTitle className="text-xl">About</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="whitespace-pre-line text-base leading-relaxed text-secondary-700">
                  {provider.bio || "No description available."}
                </p>
                {provider.cancellationPolicy?.trim() && (
                  <div className="mt-6 border-t border-secondary-200 pt-4">
                    <h3 className="mb-1.5 text-sm font-semibold text-secondary-800">
                      Cancellation policy
                    </h3>
                    <p className="whitespace-pre-line text-sm leading-relaxed text-secondary-600">
                      {provider.cancellationPolicy}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Specialties */}
            {provider.specialties && provider.specialties.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-xl">
                    <Sparkles className="h-5 w-5 text-primary-600" />
                    Specialties
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-3">
                    {provider.specialties.map((s) => (
                      <Badge
                        key={s.id}
                        variant="secondary"
                        className="px-4 py-2 text-base"
                      >
                        {s.specialty}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Service offerings */}
            {providerServices.filter((s) => s.isActive).length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-xl">
                    <DollarSign className="h-5 w-5 text-primary-600" />
                    Services &amp; pricing
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="divide-y divide-secondary-100">
                    {providerServices
                      .filter((s) => s.isActive)
                      .map((svc) => (
                        <div key={svc.id} className="flex items-start justify-between py-3 first:pt-0 last:pb-0">
                          <div className="min-w-0 flex-1 pr-4">
                            <p className="font-semibold text-secondary-900">{svc.name}</p>
                            {svc.description && (
                              <p className="mt-0.5 text-sm text-secondary-500">{svc.description}</p>
                            )}
                          </div>
                          <div className="shrink-0 text-right">
                            <p className="font-bold text-secondary-900">
                              GH₵ {Number(svc.basePrice).toFixed(2)}
                            </p>
                            {svc.durationMin > 0 && (
                              <p className="mt-0.5 flex items-center justify-end gap-1 text-sm text-secondary-500">
                                <Clock className="h-3.5 w-3.5" />
                                {svc.durationMin} min
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                  </div>
                  {user?.role === "CUSTOMER" && (
                    <div className="mt-4">
                      <Button size="lg" asChild>
                        <Link href={`/book/${provider.id}`}>
                          <Calendar className="mr-2 h-5 w-5" />
                          Book a service
                        </Link>
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Service categories with primary tag */}
            {provider.categories.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-xl">
                    <Briefcase className="h-5 w-5 text-primary-600" />
                    Services offered
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-3">
                    {provider.categories.map((pc) => (
                      <span
                        key={pc.id}
                        className={`inline-flex items-center gap-2 rounded-full border-2 px-4 py-2 text-base font-semibold ${
                          pc.isPrimary
                            ? "border-primary-300 bg-primary-50 text-primary-700"
                            : "border-secondary-200 bg-white text-secondary-700"
                        }`}
                      >
                        {pc.category.name}
                        {pc.isPrimary && (
                          <span className="text-xs font-bold uppercase tracking-wide text-primary-500">
                            Primary
                          </span>
                        )}
                      </span>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Gallery */}
            {provider.gallery && provider.gallery.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-xl">
                    <ImageIcon className="h-5 w-5 text-primary-600" />
                    Work gallery
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <GalleryLightbox gallery={provider.gallery} />
                </CardContent>
              </Card>
            )}

            {/* Reviews — flattened, not behind a tab */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-xl">
                  <Star className="h-5 w-5 text-primary-600" />
                  Reviews ({reviews.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {reviews.length === 0 ? (
                  <div className="py-8 text-center">
                    <Star className="mx-auto h-12 w-12 text-secondary-300" />
                    <p className="mt-4 text-base text-secondary-600">No reviews yet</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {reviews.map((review) => (
                      <ReviewCard
                        key={review.id}
                        review={review}
                        canReply={
                          user?.role === "PROVIDER" &&
                          user?.id === provider?.user?.id
                        }
                      />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right Column: Action sidebar */}
          <div className="space-y-6 lg:sticky lg:top-24 lg:self-start">
            {/* Map + directions — moved to the top so customers immediately
                see where this provider is located before scrolling. */}
            <ProviderLocationCard provider={provider} />

            {/* Contact Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-xl">
                  <Phone className="h-5 w-5 text-primary-600" />
                  Contact information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-4">
                  <MapPin className="h-5 w-5 shrink-0 text-secondary-400" />
                  <span className="text-base text-secondary-700">
                    {provider.location}
                    {provider.serviceRadiusKm &&
                      ` · serves up to ${provider.serviceRadiusKm} km`}
                  </span>
                </div>
                {canSeeContact ? (
                  <>
                    {provider.user.email && (
                      <div className="flex items-center gap-4">
                        <Mail className="h-5 w-5 shrink-0 text-secondary-400" />
                        <span className="break-all text-base text-secondary-700">
                          {provider.user.email}
                        </span>
                      </div>
                    )}
                    {provider.user.phone && (
                      <div className="flex items-center gap-4">
                        <Phone className="h-5 w-5 shrink-0 text-secondary-400" />
                        <span className="text-base text-secondary-700">
                          {provider.user.phone}
                        </span>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="rounded-xl border border-dashed border-secondary-200 bg-secondary-50 p-4">
                    <div className="flex items-start gap-3">
                      <Lock className="mt-0.5 h-5 w-5 shrink-0 text-primary-600" />
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-secondary-900">
                          Contact unlocks after booking
                        </p>
                        <p className="mt-1 text-sm leading-relaxed text-secondary-600">
                          Phone &amp; email are shared with you once you book
                          this provider. Use the in-app{" "}
                          <strong>Message</strong> button to ask questions
                          first — no personal details required.
                        </p>
                        {(!user || user.role === "CUSTOMER") && (
                          <div className="mt-3 flex flex-wrap gap-2">
                            <Button size="sm" asChild>
                              <Link href={`/book/${provider.id}`}>
                                <Calendar className="mr-1.5 h-4 w-4" />
                                Book now
                              </Link>
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleMessage(provider.id)}
                              isLoading={messaging}
                            >
                              <MessageSquare className="mr-1.5 h-4 w-4" />
                              Message
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Availability Calendar */}
            <ProviderAvailabilitySection provider={provider} />

            {/* Book CTA (sticky sidebar) */}
            <Card className="border-2 border-primary-200 bg-primary-50">
              <CardContent className="p-6 text-center">
                <h3 className="text-xl font-bold text-secondary-900">
                  Ready to book?
                </h3>
                <p className="mt-2 text-base text-secondary-600">
                  Pick a date and time, and the provider will confirm.
                </p>
                <Button size="xl" className="mt-6 w-full" asChild>
                  <Link href={`/book/${provider.id}`}>
                    <Calendar className="mr-2 h-5 w-5" />
                    Book Now
                  </Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Location + Directions ──────────────────────────────────────────────────

function ProviderLocationCard({ provider }: { provider: Provider }) {
  const [userLoc, setUserLoc] = useState<{ lat: number; lng: number } | null>(
    null,
  );
  const [geoStatus, setGeoStatus] = useState<
    | "idle"
    | "locating"
    | "ready"
    | "denied"
    | "unavailable"
    | "timeout"
    | "unsupported"
  >("idle");

  const hasCoords =
    typeof provider.latitude === "number" &&
    typeof provider.longitude === "number";

  // Fallback geocode: when the provider didn't set an exact pin, look up the
  // text in `provider.location` via Mapbox so we can still render a rough-area
  // map instead of the dead-end "no pin yet" placeholder. We never persist
  // these coords — they're a per-render approximation only.
  const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  const [geocoded, setGeocoded] = useState<{
    lat: number;
    lng: number;
  } | null>(null);
  const [geocoding, setGeocoding] = useState(false);
  useEffect(() => {
    if (hasCoords || !provider.location || !mapboxToken) return;
    let cancelled = false;
    setGeocoding(true);
    const url =
      `https://api.mapbox.com/search/geocode/v6/forward?` +
      `q=${encodeURIComponent(provider.location)}` +
      `&country=gh&limit=1&language=en&access_token=${mapboxToken}`;
    fetch(url)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`${r.status}`))))
      .then((data: { features?: Array<{ geometry?: { coordinates?: [number, number] } }> }) => {
        if (cancelled) return;
        const coords = data.features?.[0]?.geometry?.coordinates;
        if (coords && Number.isFinite(coords[0]) && Number.isFinite(coords[1])) {
          setGeocoded({ lat: coords[1], lng: coords[0] });
        }
      })
      .catch(() => {
        /* Silent — fall back to the placeholder UI */
      })
      .finally(() => {
        if (!cancelled) setGeocoding(false);
      });
    return () => {
      cancelled = true;
    };
  }, [hasCoords, provider.location, mapboxToken]);

  // Effective coords for rendering — prefer the provider's exact pin if set,
  // otherwise the geocoded approximation.
  const renderProvider: Provider | null = hasCoords
    ? provider
    : geocoded
      ? { ...provider, latitude: geocoded.lat, longitude: geocoded.lng }
      : null;
  const isApproximate = !hasCoords && !!renderProvider;

  const requestLocation = async () => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setGeoStatus("unsupported");
      return;
    }
    if (typeof window !== "undefined" && !window.isSecureContext) {
      setGeoStatus("unsupported");
      return;
    }
    // If the user already denied this site in the past, calling
    // getCurrentPosition rejects instantly with no prompt — short-circuit to
    // the guidance state instead.
    const perm = await queryPermission("geolocation");
    if (perm === "denied") {
      setGeoStatus("denied");
      return;
    }
    setGeoStatus("locating");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLoc({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setGeoStatus("ready");
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) setGeoStatus("denied");
        else if (err.code === err.TIMEOUT) setGeoStatus("timeout");
        else setGeoStatus("unavailable");
      },
      { enableHighAccuracy: false, timeout: 15000, maximumAge: 5 * 60 * 1000 },
    );
  };

  // Only fall back to the static placeholder when (a) the provider has no
  // exact pin AND (b) the geocoding fallback also returned nothing (no
  // location text, no Mapbox token, or no match).
  if (!renderProvider) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <MapPin className="h-5 w-5 text-primary-600" />
            Location & directions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-xl border-2 border-dashed border-secondary-200 bg-secondary-50 p-6 text-center">
            <MapPin className="mx-auto h-8 w-8 text-secondary-300" />
            <p className="mt-3 text-sm font-semibold text-secondary-700">
              {geocoding ? "Looking up area…" : "No map pin set yet"}
            </p>
            <p className="mt-1 text-xs text-secondary-500">
              This provider hasn&apos;t shared exact coordinates. They&apos;re
              based in <strong>{provider.location || "their listed area"}</strong>
              {provider.serviceRadiusKm
                ? ` and serve up to ${provider.serviceRadiusKm} km.`
                : "."}
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <MapPin className="h-5 w-5 text-primary-600" />
          Location & directions
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <ProvidersMap
          providers={[renderProvider]}
          userLocation={userLoc}
          enableRouting={!!userLoc}
          height="320px"
          linkProviderProfile={false}
        />
        {isApproximate && (
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900/40 dark:bg-amber-900/20 dark:text-amber-100">
            Approximate area only — this provider hasn&apos;t shared an exact
            pin. Driving directions are estimated to{" "}
            <strong>{provider.location}</strong>.
          </p>
        )}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-secondary-500">
            Click <strong>Get directions</strong> to share your location and
            see the driving route + estimated travel time.
          </p>
          {userLoc ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setUserLoc(null);
                setGeoStatus("idle");
              }}
            >
              Clear directions
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={requestLocation}
              isLoading={geoStatus === "locating"}
              disabled={geoStatus === "unsupported"}
            >
              {geoStatus === "denied"
                ? "Permission blocked — retry"
                : geoStatus === "timeout"
                  ? "Took too long — retry"
                  : geoStatus === "unavailable"
                    ? "No location signal — retry"
                    : geoStatus === "unsupported"
                      ? "Geolocation unsupported"
                      : "Get directions"}
            </Button>
          )}
        </div>
        {(geoStatus === "denied" ||
          geoStatus === "unavailable" ||
          geoStatus === "timeout" ||
          geoStatus === "unsupported") && (
          <p className="text-xs text-secondary-500">
            {geoStatus === "denied"
              ? "You blocked location access. Click the lock icon in the address bar → Site settings → Location → Allow, then retry."
              : geoStatus === "unavailable"
                ? "Your device couldn't determine its location. On Windows make sure Settings → Privacy → Location is on; desktops without GPS often need Wi-Fi for a rough fix."
                : geoStatus === "timeout"
                  ? "The lookup timed out. Check your network and try again."
                  : "This page must be served over HTTPS for geolocation to work."}
          </p>
        )}
        {userLoc && (
          <a
            href={`https://www.google.com/maps/dir/?api=1&origin=${userLoc.lat},${userLoc.lng}&destination=${renderProvider.latitude},${renderProvider.longitude}&travelmode=driving`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary-600 px-4 py-3 text-sm font-bold text-white shadow-sm transition-colors hover:bg-primary-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2"
          >
            <ExternalLink className="h-4 w-4" />
            Open turn-by-turn directions in Google Maps
          </a>
        )}
      </CardContent>
    </Card>
  );
}
