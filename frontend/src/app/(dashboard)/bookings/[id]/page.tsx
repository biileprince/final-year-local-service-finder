"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import {
  Calendar,
  Clock,
  MapPin,
  ChevronLeft,
  MessageSquare,
  Phone,
  CheckCircle,
  XCircle,
  AlertCircle,
  Star,
  Banknote,
  CalendarClock,
  ImagePlus,
  X,
  Paperclip,
  FileText,
  Navigation,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { Spinner, Skeleton } from "@/components/ui/spinner";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { useAuth } from "@/hooks";
import { bookingsService, reviewsService, messagesService, filesService } from "@/lib/api";
import { ProvidersMap } from "@/components/providers/providers-map";
import { queryPermission } from "@/lib/permissions";
import type { Booking, BookingStatus } from "@/types";
import { formatDate, formatTime, formatCurrency, cn } from "@/lib/utils";

const statusConfig: Record<
  BookingStatus,
  {
    label: string;
    variant: "default" | "success" | "warning" | "error" | "info";
    icon: React.ElementType;
  }
> = {
  PENDING: { label: "Pending Confirmation", variant: "warning", icon: AlertCircle },
  CONFIRMED: { label: "Confirmed", variant: "default", icon: CheckCircle },
  IN_PROGRESS: { label: "In Progress", variant: "default", icon: Clock },
  COMPLETED: { label: "Completed", variant: "success", icon: CheckCircle },
  CANCELLED: { label: "Cancelled", variant: "error", icon: XCircle },
  NO_SHOW: { label: "No-show", variant: "error", icon: AlertCircle },
};

const PAYMENT_METHODS = [
  { value: "cash", label: "Cash" },
  { value: "mobile-money", label: "Mobile Money (MoMo)" },
  { value: "bank-transfer", label: "Bank Transfer" },
  { value: "cheque", label: "Cheque" },
];

export default function BookingDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const [booking, setBooking] = useState<Booking | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [openingChat, setOpeningChat] = useState(false);

  // Review form state
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState("");
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [reviewImages, setReviewImages] = useState<
    { id: string; url: string }[]
  >([]);
  const [reviewUploading, setReviewUploading] = useState(false);
  const [attachmentUploading, setAttachmentUploading] = useState(false);

  // Reschedule state
  const [showReschedule, setShowReschedule] = useState(false);
  const [rescheduleDate, setRescheduleDate] = useState("");
  const [rescheduleTime, setRescheduleTime] = useState("");
  const [rescheduleFlexible, setRescheduleFlexible] = useState(false);
  const [rescheduleError, setRescheduleError] = useState<string | null>(null);

  // Confirm dialogs (destructive actions)
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [confirmDecline, setConfirmDecline] = useState(false);

  // Provider confirm flow with optional time (flexible bookings)
  const [showConfirmTime, setShowConfirmTime] = useState(false);
  const [confirmTime, setConfirmTime] = useState("");

  // Provider location for routing to the customer's service address.
  const [providerLocation, setProviderLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [detectingProviderLoc, setDetectingProviderLoc] = useState(false);

  const { toast } = useToast();

  // Lets the prominent "Leave a review" banner scroll the form into view.
  const reviewSectionRef = useRef<HTMLDivElement>(null);

  const openReviewForm = () => {
    setShowReviewForm(true);
    // Wait a tick so the form is mounted before scrolling to it.
    requestAnimationFrame(() =>
      reviewSectionRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      }),
    );
  };

  // Payment recording state
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [paymentReference, setPaymentReference] = useState("");
  const [paymentError, setPaymentError] = useState<string | null>(null);

  useEffect(() => {
    if (params.id) loadBooking(params.id as string);
  }, [params.id]);

  // Auto-detect the provider's location once the booking loads — but only if
  // the browser has *already* granted geolocation, so we never trigger a
  // surprise permission prompt. This lets the route render automatically for
  // returning providers; first-timers still use the explicit button.
  useEffect(() => {
    if (!booking || providerLocation) return;
    if (user?.role !== "PROVIDER") return;
    if (!booking.serviceLatitude || !booking.serviceLongitude) return;
    let cancelled = false;
    (async () => {
      const perm = await queryPermission("geolocation");
      if (cancelled || perm !== "granted") return;
      handleDetectProviderLocation();
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [booking, user]);

  const loadBooking = async (id: string) => {
    setIsLoading(true);
    try {
      const data = await bookingsService.getById(id);
      setBooking(data);
    } catch (err) {
      toast({
        variant: "error",
        title: "Failed to load booking",
        description: err instanceof Error ? err.message : "Please try again.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleStatusUpdate = async (
    newStatus: BookingStatus,
    options?: { scheduledStartTime?: string; cancelReason?: string },
  ) => {
    if (!booking) return;
    setIsUpdating(true);
    try {
      let updated: Booking;
      if (newStatus === "CONFIRMED") {
        updated = await bookingsService.confirm(
          booking.id,
          options?.scheduledStartTime,
        );
      } else if (newStatus === "IN_PROGRESS") {
        updated = await bookingsService.start(booking.id);
      } else if (newStatus === "COMPLETED") {
        updated = await bookingsService.complete(booking.id);
      } else if (newStatus === "CANCELLED") {
        updated = await bookingsService.cancel(
          booking.id,
          options?.cancelReason ?? "Cancelled by user",
        );
      } else {
        return;
      }
      setBooking(updated);
      toast({
        variant: "success",
        title: `Booking ${newStatus.toLowerCase().replace("_", " ")}`,
      });
    } catch (err) {
      toast({
        variant: "error",
        title: "Action failed",
        description: err instanceof Error ? err.message : "Please try again.",
      });
    } finally {
      setIsUpdating(false);
      setConfirmCancel(false);
      setConfirmDecline(false);
      setShowConfirmTime(false);
    }
  };

  const handleNoShow = async () => {
    if (!booking) return;
    setIsUpdating(true);
    try {
      const updated = await bookingsService.flagNoShow(booking.id);
      setBooking(updated);
      toast({ variant: "success", title: "Marked as a no-show" });
    } catch (err) {
      toast({
        variant: "error",
        title: "Action failed",
        description: err instanceof Error ? err.message : "Please try again.",
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleSubmitReview = async () => {
    if (!booking) return;
    const trimmed = reviewComment.trim();
    if (trimmed.length < 10) {
      setReviewError("Please write at least 10 characters about your experience.");
      return;
    }
    setReviewError(null);
    setIsUpdating(true);
    try {
      await reviewsService.create({
        providerId: booking.providerId,
        bookingId: booking.id,
        rating: reviewRating,
        comment: trimmed,
        imageIds: reviewImages.map((i) => i.id),
      });
      setShowReviewForm(false);
      setReviewComment("");
      setReviewImages([]);
      loadBooking(booking.id);
    } catch (err) {
      setReviewError(
        err instanceof Error ? err.message : "Failed to submit review.",
      );
    } finally {
      setIsUpdating(false);
    }
  };

  const handleAttachmentUpload = async (file: File) => {
    if (!booking) return;
    setAttachmentUploading(true);
    try {
      const uploaded = await filesService.upload(file, "BOOKING");
      await bookingsService.addAttachment(booking.id, uploaded.id);
      await loadBooking(booking.id);
    } catch (err) {
      toast({
        variant: "error",
        title: "Upload failed",
        description: err instanceof Error ? err.message : "Try again.",
      });
    } finally {
      setAttachmentUploading(false);
    }
  };

  const handleAttachmentRemove = async (attachmentId: string) => {
    if (!booking) return;
    try {
      await bookingsService.removeAttachment(booking.id, attachmentId);
      await loadBooking(booking.id);
    } catch (err) {
      toast({
        variant: "error",
        title: "Couldn't remove attachment",
        description: err instanceof Error ? err.message : "Try again.",
      });
    }
  };

  const handleOpenMessage = async () => {
    if (!booking) return;
    setOpeningChat(true);
    try {
      const conv = await messagesService.startConversation(
        booking.providerId,
        booking.id,
      );
      router.push(`/messages/${conv.id}`);
    } catch (err) {
      setOpeningChat(false);
      toast({
        variant: "error",
        title: "Couldn't open chat",
        description: err instanceof Error ? err.message : "Please try again.",
      });
    }
  };

  const handleReschedule = async () => {
    if (!booking) return;
    if (!rescheduleDate) {
      setRescheduleError("Please pick a new date.");
      return;
    }
    if (!rescheduleFlexible && !rescheduleTime) {
      setRescheduleError("Please pick a new time or choose flexible.");
      return;
    }
    setRescheduleError(null);
    setIsUpdating(true);
    try {
      const updated = await bookingsService.reschedule(booking.id, {
        scheduledDate: rescheduleDate,
        scheduledStartTime: rescheduleFlexible
          ? undefined
          : `${rescheduleTime}:00`,
      });
      setBooking(updated);
      setShowReschedule(false);
      setRescheduleDate("");
      setRescheduleTime("");
      setRescheduleFlexible(false);
    } catch (err) {
      setRescheduleError(
        err instanceof Error ? err.message : "Failed to reschedule.",
      );
    } finally {
      setIsUpdating(false);
    }
  };

  const handleRecordPayment = async () => {
    if (!booking) return;
    if (!paymentReference.trim()) {
      setPaymentError("Please enter a payment reference.");
      return;
    }
    setPaymentError(null);
    setIsUpdating(true);
    try {
      const updated = await bookingsService.recordPayment(booking.id, {
        paymentMethod,
        paymentReference: paymentReference.trim(),
      });
      setBooking(updated);
      setShowPaymentForm(false);
      setPaymentReference("");
    } catch (err) {
      setPaymentError(
        err instanceof Error ? err.message : "Failed to record payment.",
      );
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDetectProviderLocation = () => {
    if (!navigator.geolocation) return;
    setDetectingProviderLoc(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setProviderLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setDetectingProviderLoc(false);
      },
      () => setDetectingProviderLoc(false),
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 5 * 60 * 1000 },
    );
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-6 w-24 rounded-full" />
        </div>
        <Card>
          <CardContent className="space-y-4 p-5">
            <div className="flex items-start gap-4">
              <Skeleton className="h-16 w-16 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-5 w-1/3" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-4 w-1/2" />
            </div>
            <div className="space-y-2 pt-2">
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-5/6" />
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!booking) {
    return (
      <div className="space-y-4 text-center">
        <h1 className="text-2xl font-bold text-secondary-900">Booking not found</h1>
        <p className="text-secondary-600">The booking you are looking for does not exist.</p>
        <Button asChild>
          <Link href="/bookings">Back to Bookings</Link>
        </Button>
      </div>
    );
  }

  const status = statusConfig[booking.status];
  const StatusIcon = status.icon;
  const isProvider = user?.role === "PROVIDER";
  const otherUser = isProvider ? booking.customer : booking.provider?.user;
  const paymentRecorded = booking.paymentStatus === "PAID";

  // Google Maps turn-by-turn link for the provider. Prefer exact customer
  // coordinates; fall back to the typed address. When we've detected the
  // provider's own location, pass it as the origin so Google opens a real
  // start→destination route instead of guessing the origin.
  const hasCustomerCoords =
    booking.serviceLatitude != null && booking.serviceLongitude != null;
  const directionsDestination = hasCustomerCoords
    ? `${booking.serviceLatitude},${booking.serviceLongitude}`
    : encodeURIComponent(booking.serviceAddress);
  const googleMapsDirectionsUrl = providerLocation
    ? `https://www.google.com/maps/dir/?api=1&origin=${providerLocation.lat},${providerLocation.lng}&destination=${directionsDestination}&travelmode=driving`
    : `https://www.google.com/maps/dir/?api=1&destination=${directionsDestination}&travelmode=driving`;

  // Whether the scheduled day is in the past — used to nudge a provider who
  // may have finished the job but forgotten to update the booking status.
  const scheduledPast = (() => {
    const d = new Date(booking.scheduledDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return d < today;
  })();
  const customerNeedsReview =
    !isProvider && booking.status === "COMPLETED" && !booking.review;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Link
          href="/bookings"
          className="mb-4 inline-flex items-center text-sm text-secondary-600 hover:text-secondary-900"
        >
          <ChevronLeft className="mr-1 h-4 w-4" />
          Back to bookings
        </Link>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-secondary-900">
              Booking #{booking.bookingNumber}
            </h1>
            <div className="mt-2 flex items-center gap-2">
              <Badge variant={status.variant}>
                <StatusIcon className="mr-1 h-3 w-3" />
                {status.label}
              </Badge>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {/* Primary provider action — visible at a glance without scrolling */}
            {isProvider && booking.status === "PENDING" && (
              <Button
                onClick={() => {
                  const isFlexible =
                    !booking.scheduledStartTime ||
                    new Date(booking.scheduledStartTime)
                      .toISOString()
                      .slice(11, 19) === "00:00:00";
                  if (isFlexible) setShowConfirmTime(true);
                  else handleStatusUpdate("CONFIRMED");
                }}
                isLoading={isUpdating}
              >
                <CheckCircle className="mr-2 h-4 w-4" />
                Confirm Booking
              </Button>
            )}
            {isProvider && booking.status === "CONFIRMED" && (
              <Button onClick={() => handleStatusUpdate("IN_PROGRESS")} isLoading={isUpdating}>
                Start Service
              </Button>
            )}
            {isProvider && booking.status === "IN_PROGRESS" && (
              <Button onClick={() => handleStatusUpdate("COMPLETED")} isLoading={isUpdating}>
                <CheckCircle className="mr-2 h-4 w-4" />
                Mark Completed
              </Button>
            )}
            <Button
              variant="outline"
              onClick={handleOpenMessage}
              isLoading={openingChat}
            >
              <MessageSquare className="mr-2 h-4 w-4" />
              Message
            </Button>
            {otherUser?.phone && (
              <Button variant="outline">
                <Phone className="mr-2 h-4 w-4" />
                Call
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* ── Status guidance banners ── */}
      {customerNeedsReview && (
        <Card className="border-2 border-warning-300 bg-warning-50">
          <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-warning-100">
                <Star className="h-5 w-5 fill-warning-500 text-warning-500" />
              </div>
              <div>
                <p className="font-semibold text-secondary-900">
                  How was your service?
                </p>
                <p className="text-sm text-secondary-600">
                  Your booking is complete. Leave a quick review to help{" "}
                  {otherUser?.name ?? "your provider"} and other customers.
                </p>
              </div>
            </div>
            <Button onClick={openReviewForm} className="shrink-0">
              <Star className="mr-2 h-4 w-4" />
              Leave a review
            </Button>
          </CardContent>
        </Card>
      )}

      {isProvider && booking.status === "IN_PROGRESS" && (
        <Card className="border-2 border-primary-200 bg-primary-50">
          <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-100">
                <CheckCircle className="h-5 w-5 text-primary-600" />
              </div>
              <div>
                <p className="font-semibold text-secondary-900">
                  Finished the job?
                </p>
                <p className="text-sm text-secondary-600">
                  Mark this service as completed so the customer can pay and
                  leave a review. Don&apos;t leave it stuck in progress.
                </p>
              </div>
            </div>
            <Button
              onClick={() => handleStatusUpdate("COMPLETED")}
              isLoading={isUpdating}
              className="shrink-0"
            >
              <CheckCircle className="mr-2 h-4 w-4" />
              Mark completed
            </Button>
          </CardContent>
        </Card>
      )}

      {isProvider && booking.status === "CONFIRMED" && scheduledPast && (
        <Card className="border-2 border-warning-300 bg-warning-50">
          <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-warning-100">
                <AlertCircle className="h-5 w-5 text-warning-600" />
              </div>
              <div>
                <p className="font-semibold text-secondary-900">
                  This booking&apos;s scheduled date has passed
                </p>
                <p className="text-sm text-secondary-600">
                  If you&apos;ve done the work, start the service and mark it
                  completed so the customer can leave a review.
                </p>
              </div>
            </div>
            <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
              <Button
                onClick={() => handleStatusUpdate("IN_PROGRESS")}
                isLoading={isUpdating}
              >
                Start service
              </Button>
              <Button
                variant="outline"
                onClick={handleNoShow}
                isLoading={isUpdating}
              >
                Customer didn&apos;t show
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {!isProvider && booking.status === "CONFIRMED" && scheduledPast && (
        <Card className="border-2 border-warning-300 bg-warning-50">
          <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-warning-100">
                <AlertCircle className="h-5 w-5 text-warning-600" />
              </div>
              <div>
                <p className="font-semibold text-secondary-900">
                  Did the provider show up?
                </p>
                <p className="text-sm text-secondary-600">
                  If your provider never arrived for this appointment, you can
                  flag it as a no-show.
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              onClick={handleNoShow}
              isLoading={isUpdating}
              className="shrink-0"
            >
              Provider didn&apos;t show
            </Button>
          </CardContent>
        </Card>
      )}

      {booking.status === "NO_SHOW" && (
        <Card className="border-2 border-error-200 bg-error-50">
          <CardContent className="flex items-start gap-3 p-4">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-error-600" />
            <div>
              <p className="font-semibold text-secondary-900">
                Marked as a no-show
              </p>
              <p className="text-sm text-secondary-600">
                {booking.noShowParty === "PROVIDER"
                  ? "The provider was flagged as not showing up for this appointment."
                  : "The customer was flagged as not showing up for this appointment."}
                {booking.noShowReason ? ` "${booking.noShowReason}"` : ""}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Info */}
        <div className="space-y-6 lg:col-span-2">
          {/* Contact Info */}
          <Card>
            <CardHeader>
              <CardTitle>{isProvider ? "Customer" : "Service Provider"}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4">
                <Avatar size="lg" src={otherUser?.profileImage} name={otherUser?.name} />
                <div>
                  <h3 className="font-semibold text-secondary-900">{otherUser?.name}</h3>
                  <p className="text-sm text-secondary-500">{otherUser?.email}</p>
                  {otherUser?.phone && (
                    <p className="text-sm text-secondary-500">{otherUser.phone}</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Service Details */}
          <Card>
            <CardHeader>
              <CardTitle>Service Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-start gap-3">
                <Calendar className="mt-0.5 h-5 w-5 text-secondary-400" />
                <div>
                  <p className="font-medium text-secondary-900">Date</p>
                  <p className="text-secondary-600">{formatDate(booking.scheduledDate)}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Clock className="mt-0.5 h-5 w-5 text-secondary-400" />
                <div>
                  <p className="font-medium text-secondary-900">Time</p>
                  <p className="text-secondary-600">
                    {formatTime(booking.scheduledStartTime)}
                    {booking.scheduledEndTime && ` — ${formatTime(booking.scheduledEndTime)}`}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <MapPin className="mt-0.5 h-5 w-5 text-secondary-400" />
                <div className="flex-1">
                  <p className="font-medium text-secondary-900">Location</p>
                  <p className="text-secondary-600">{booking.serviceAddress}</p>
                  {isProvider && (
                    <a
                      href={googleMapsDirectionsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-1.5 inline-flex items-center gap-1.5 rounded-lg bg-primary-50 px-3 py-1.5 text-sm font-medium text-primary-700 hover:bg-primary-100"
                    >
                      <Navigation className="h-3.5 w-3.5" />
                      Open in Google Maps
                    </a>
                  )}
                </div>
              </div>
              {booking.problemDescription && (
                <div>
                  <p className="font-medium text-secondary-900">Description</p>
                  <p className="mt-1 text-secondary-600">{booking.problemDescription}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* ── Customer location map (providers only) ── */}
          {isProvider && hasCustomerCoords && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="h-5 w-5" />
                  Customer Location
                </CardTitle>
                <p className="mt-1 text-sm text-secondary-500">
                  {providerLocation
                    ? "Driving route and travel time from your location to the customer are shown below."
                    : "Show the route from where you are now, or open turn-by-turn directions in Google Maps."}
                </p>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="overflow-hidden rounded-xl">
                  <ProvidersMap
                    providers={[]}
                    customerPin={{
                      lat: booking.serviceLatitude!,
                      lng: booking.serviceLongitude!,
                      label: booking.customer?.name ?? "Customer",
                    }}
                    userLocation={providerLocation}
                    enableRouting={!!providerLocation}
                    height="280px"
                    linkProviderProfile={false}
                  />
                </div>
                {/* Clear, labelled controls so the provider knows exactly what
                    each button does. */}
                <div className="flex flex-col gap-2 sm:flex-row">
                  {!providerLocation && (
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={handleDetectProviderLocation}
                      isLoading={detectingProviderLoc}
                    >
                      <Navigation className="mr-2 h-4 w-4" />
                      Show route on map
                    </Button>
                  )}
                  <Button asChild className="flex-1">
                    <a
                      href={googleMapsDirectionsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <ExternalLink className="mr-2 h-4 w-4" />
                      Open turn-by-turn in Google Maps
                    </a>
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* ── Attachments ── */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Paperclip className="h-5 w-5" />
                Attachments
              </CardTitle>
            </CardHeader>
            <CardContent>
              {(booking.attachments?.length ?? 0) === 0 ? (
                <p className="text-sm text-secondary-500">
                  No attachments yet. Photos or documents shared here are
                  visible to both the customer and the provider.
                </p>
              ) : (
                <div className="flex flex-wrap gap-3">
                  {booking.attachments?.map((a) => {
                    const isImage = (a.file.mimeType || "").startsWith("image/");
                    const canRemove = a.uploadedById === user?.id;
                    return (
                      <div
                        key={a.id}
                        className="relative w-32 overflow-hidden rounded-lg border border-secondary-200 bg-secondary-50"
                      >
                        <a
                          href={a.file.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block"
                        >
                          {isImage ? (
                            <Image
                              src={a.file.thumbnailUrl || a.file.url}
                              alt={a.file.fileName}
                              width={128}
                              height={112}
                              sizes="128px"
                              className="h-28 w-32 object-cover"
                            />
                          ) : (
                            <div className="flex h-28 w-32 flex-col items-center justify-center px-2 text-center">
                              <FileText className="h-7 w-7 text-secondary-400" />
                              <span className="mt-1 truncate text-[11px] text-secondary-600">
                                {a.file.fileName}
                              </span>
                            </div>
                          )}
                        </a>
                        {a.uploadedBy && (
                          <p className="truncate border-t border-secondary-100 bg-white px-2 py-1 text-[10px] text-secondary-500">
                            by {a.uploadedBy.name}
                          </p>
                        )}
                        {canRemove && (
                          <button
                            type="button"
                            onClick={() => handleAttachmentRemove(a.id)}
                            className="absolute right-1 top-1 rounded-full bg-black/60 p-0.5 text-white"
                            aria-label="Remove attachment"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
              {booking.status !== "CANCELLED" &&
                booking.status !== "COMPLETED" && (
                  <div className="mt-4">
                    <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-secondary-300 px-3 py-2 text-sm font-medium text-secondary-700 hover:border-primary-400 hover:text-primary-600">
                      <input
                        type="file"
                        accept="image/*,application/pdf"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          e.target.value = "";
                          if (file) void handleAttachmentUpload(file);
                        }}
                      />
                      {attachmentUploading ? (
                        <Spinner size="sm" />
                      ) : (
                        <Paperclip className="h-4 w-4" />
                      )}
                      Add file
                    </label>
                  </div>
                )}
            </CardContent>
          </Card>

          {/* ── Provider workflow actions ── */}
          {isProvider && booking.status === "PENDING" && (
            <Card>
              <CardHeader>
                <CardTitle>Respond to Booking</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="mb-4 text-secondary-600">
                  Please confirm or decline this booking request.
                </p>
                <div className="flex flex-wrap gap-3">
                  <Button
                    onClick={() => {
                      const isFlexible =
                        !booking.scheduledStartTime ||
                        new Date(booking.scheduledStartTime)
                          .toISOString()
                          .slice(11, 19) === "00:00:00";
                      if (isFlexible) {
                        setShowConfirmTime(true);
                      } else {
                        handleStatusUpdate("CONFIRMED");
                      }
                    }}
                    isLoading={isUpdating}
                  >
                    <CheckCircle className="mr-2 h-4 w-4" />
                    Confirm Booking
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setConfirmDecline(true)}
                    isLoading={isUpdating}
                  >
                    <XCircle className="mr-2 h-4 w-4" />
                    Decline
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {isProvider && booking.status === "CONFIRMED" && (
            <Card>
              <CardContent className="py-4">
                <Button onClick={() => handleStatusUpdate("IN_PROGRESS")} isLoading={isUpdating}>
                  Start Service
                </Button>
              </CardContent>
            </Card>
          )}

          {isProvider && booking.status === "IN_PROGRESS" && (
            <Card>
              <CardContent className="py-4">
                <Button onClick={() => handleStatusUpdate("COMPLETED")} isLoading={isUpdating}>
                  <CheckCircle className="mr-2 h-4 w-4" />
                  Mark as Completed
                </Button>
              </CardContent>
            </Card>
          )}

          {/* ── Offline payment recording (provider, completed, unpaid) ── */}
          {isProvider && booking.status === "COMPLETED" && !paymentRecorded && (
            <Card>
              <CardHeader>
                <CardTitle>Record Payment</CardTitle>
              </CardHeader>
              <CardContent>
                {!showPaymentForm ? (
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-secondary-600">
                      Payment has not been recorded for this booking.
                    </p>
                    <Button variant="outline" onClick={() => setShowPaymentForm(true)}>
                      <Banknote className="mr-2 h-4 w-4" />
                      Record payment
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {paymentError && (
                      <p className="text-sm font-semibold text-red-600">{paymentError}</p>
                    )}
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-secondary-700">
                        Payment method
                      </label>
                      <select
                        value={paymentMethod}
                        onChange={(e) => setPaymentMethod(e.target.value)}
                        className="w-full rounded-xl border-2 border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-900 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                      >
                        {PAYMENT_METHODS.map((m) => (
                          <option key={m.value} value={m.value}>
                            {m.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-secondary-700">
                        Reference / receipt number
                      </label>
                      <input
                        type="text"
                        value={paymentReference}
                        onChange={(e) => setPaymentReference(e.target.value)}
                        placeholder="e.g. RECEIPT-12345 or transaction ID"
                        className="w-full rounded-xl border-2 border-gray-200 px-4 py-2.5 text-sm text-gray-900 placeholder:text-gray-500 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                      />
                    </div>
                    <div className="flex gap-3">
                      <Button onClick={handleRecordPayment} isLoading={isUpdating}>
                        <Banknote className="mr-2 h-4 w-4" />
                        Confirm payment
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => {
                          setShowPaymentForm(false);
                          setPaymentError(null);
                        }}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* ── Customer: leave a review ── */}
          {!isProvider && booking.status === "COMPLETED" && !booking.review && (
            <Card
              ref={reviewSectionRef}
              className="border-2 border-warning-200 scroll-mt-24"
            >
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Star className="h-5 w-5 fill-warning-500 text-warning-500" />
                  Leave a Review
                </CardTitle>
              </CardHeader>
              <CardContent>
                {!showReviewForm ? (
                  <div className="space-y-3">
                    <p className="text-sm text-secondary-600">
                      Share your experience with {otherUser?.name ?? "the provider"}.
                      Your feedback helps other customers choose with confidence.
                    </p>
                    <Button size="lg" onClick={() => setShowReviewForm(true)}>
                      <Star className="mr-2 h-4 w-4" />
                      Write a Review
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {reviewError && (
                      <p className="text-sm font-semibold text-red-600">
                        {reviewError}
                      </p>
                    )}
                    <div>
                      <label className="mb-2 block text-sm font-medium text-secondary-700">
                        Rating
                      </label>
                      <div className="flex gap-1">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <button
                            key={star}
                            type="button"
                            onClick={() => setReviewRating(star)}
                            className="p-1"
                            aria-label={`${star} star${star === 1 ? "" : "s"}`}
                          >
                            <Star
                              className={cn(
                                "h-8 w-8 transition-colors",
                                star <= reviewRating
                                  ? "fill-warning-500 text-warning-500"
                                  : "fill-secondary-200 text-secondary-200",
                              )}
                            />
                          </button>
                        ))}
                        <span className="ml-2 self-center text-sm text-secondary-600">
                          {reviewRating}/5
                        </span>
                      </div>
                    </div>
                    <div>
                      <label className="mb-2 block text-sm font-medium text-secondary-700">
                        Comment <span className="text-secondary-500">(min 10 chars)</span>
                      </label>
                      <textarea
                        value={reviewComment}
                        onChange={(e) => setReviewComment(e.target.value)}
                        rows={4}
                        className="w-full rounded-xl border-2 border-gray-200 px-4 py-3 text-sm text-secondary-900 placeholder:text-secondary-500 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                        placeholder="Share your experience…"
                      />
                    </div>
                    <div>
                      <label className="mb-2 block text-sm font-medium text-secondary-700">
                        Photos <span className="text-secondary-500">(up to 6)</span>
                      </label>
                      <div className="flex flex-wrap gap-2">
                        {reviewImages.map((img) => (
                          <div
                            key={img.id}
                            className="relative h-20 w-20 overflow-hidden rounded-lg border border-secondary-200"
                          >
                            <Image
                              src={img.url}
                              alt="Review attachment"
                              fill
                              sizes="80px"
                              className="object-cover"
                            />
                            <button
                              type="button"
                              onClick={() =>
                                setReviewImages((prev) =>
                                  prev.filter((p) => p.id !== img.id),
                                )
                              }
                              className="absolute right-1 top-1 rounded-full bg-black/60 p-0.5 text-white"
                              aria-label="Remove image"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </div>
                        ))}
                        {reviewImages.length < 6 && (
                          <label className="flex h-20 w-20 cursor-pointer items-center justify-center rounded-lg border-2 border-dashed border-secondary-300 text-secondary-400 hover:border-primary-400 hover:text-primary-500">
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={async (e) => {
                                const file = e.target.files?.[0];
                                e.target.value = "";
                                if (!file) return;
                                setReviewUploading(true);
                                try {
                                  const uploaded = await filesService.upload(
                                    file,
                                    "REVIEW",
                                  );
                                  setReviewImages((prev) => [
                                    ...prev,
                                    { id: uploaded.id, url: uploaded.url },
                                  ]);
                                } catch (err) {
                                  setReviewError(
                                    err instanceof Error
                                      ? err.message
                                      : "Upload failed",
                                  );
                                } finally {
                                  setReviewUploading(false);
                                }
                              }}
                            />
                            {reviewUploading ? (
                              <Spinner size="sm" />
                            ) : (
                              <ImagePlus className="h-6 w-6" />
                            )}
                          </label>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <Button onClick={handleSubmitReview} isLoading={isUpdating}>
                        Submit Review
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => {
                          setShowReviewForm(false);
                          setReviewError(null);
                          setReviewImages([]);
                        }}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {booking.review && (
            <Card>
              <CardHeader>
                <CardTitle>Your Review</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="mb-2 flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star
                      key={star}
                      className={cn(
                        "h-5 w-5",
                        star <= booking.review!.rating
                          ? "fill-warning-500 text-warning-500"
                          : "fill-secondary-200 text-secondary-200",
                      )}
                    />
                  ))}
                </div>
                {booking.review.comment && (
                  <p className="text-secondary-700">{booking.review.comment}</p>
                )}
                {booking.review.images && booking.review.images.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {booking.review.images.map((img) => (
                      <Image
                        key={img.id}
                        src={img.file.thumbnailUrl || img.file.url}
                        alt="Review photo"
                        width={80}
                        height={80}
                        sizes="80px"
                        className="h-20 w-20 rounded-lg object-cover"
                      />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Payment Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {booking.estimatedAmount && (
                <div className="flex justify-between">
                  <span className="text-secondary-600">Estimated</span>
                  <span className="font-medium text-secondary-900">
                    {formatCurrency(Number(booking.estimatedAmount))}
                  </span>
                </div>
              )}
              {booking.finalAmount && (
                <div className="flex justify-between">
                  <span className="text-secondary-600">Final Amount</span>
                  <span className="font-bold text-primary-600">
                    {formatCurrency(Number(booking.finalAmount))}
                  </span>
                </div>
              )}
              {booking.paymentMethod && (
                <div className="flex justify-between">
                  <span className="text-secondary-600">Method</span>
                  <span className="font-medium capitalize text-secondary-900">
                    {booking.paymentMethod}
                  </span>
                </div>
              )}
              {booking.paymentStatus && (
                <div className="flex justify-between">
                  <span className="text-secondary-600">Status</span>
                  <Badge
                    variant={
                      booking.paymentStatus === "PAID"
                        ? "success"
                        : booking.paymentStatus === "PENDING"
                          ? "warning"
                          : "default"
                    }
                  >
                    {booking.paymentStatus}
                  </Badge>
                </div>
              )}
              {paymentRecorded && (
                <p className="mt-1 flex items-center gap-1.5 text-xs text-green-700">
                  <CheckCircle className="h-3.5 w-3.5" />
                  Payment recorded
                </p>
              )}
            </CardContent>
          </Card>

          {/* Reschedule (either party, while not yet started/completed) */}
          {(booking.status === "PENDING" || booking.status === "CONFIRMED") && (
            <Card>
              <CardContent className="space-y-3 py-4">
                {!showReschedule ? (
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => {
                      setShowReschedule(true);
                      setRescheduleDate(
                        new Date(booking.scheduledDate)
                          .toISOString()
                          .split("T")[0] ?? "",
                      );
                    }}
                  >
                    <CalendarClock className="mr-2 h-4 w-4" />
                    Reschedule
                  </Button>
                ) : (
                  <div className="space-y-3">
                    {rescheduleError && (
                      <p className="text-sm font-semibold text-red-600">
                        {rescheduleError}
                      </p>
                    )}
                    <div>
                      <label className="mb-1 block text-xs font-medium text-secondary-700">
                        New date
                      </label>
                      <input
                        type="date"
                        value={rescheduleDate}
                        min={new Date().toISOString().split("T")[0]}
                        onChange={(e) => setRescheduleDate(e.target.value)}
                        className="w-full rounded-lg border-2 border-gray-200 px-3 py-2 text-sm"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-secondary-700">
                        New time
                      </label>
                      <input
                        type="time"
                        value={rescheduleTime}
                        disabled={rescheduleFlexible}
                        onChange={(e) => setRescheduleTime(e.target.value)}
                        className="w-full rounded-lg border-2 border-gray-200 px-3 py-2 text-sm disabled:bg-secondary-50 disabled:text-secondary-400"
                      />
                      <label className="mt-2 flex items-center gap-2 text-xs text-secondary-600">
                        <input
                          type="checkbox"
                          checked={rescheduleFlexible}
                          onChange={(e) => {
                            setRescheduleFlexible(e.target.checked);
                            if (e.target.checked) setRescheduleTime("");
                          }}
                        />
                        Flexible — let the provider pick a time
                      </label>
                    </div>
                    {!isProvider && booking.status === "CONFIRMED" && (
                      <p className="text-xs text-secondary-500">
                        Rescheduling a confirmed booking will return it to
                        pending so the provider can re-confirm.
                      </p>
                    )}
                    <div className="flex gap-2">
                      <Button
                        onClick={handleReschedule}
                        isLoading={isUpdating}
                        className="flex-1"
                      >
                        Save
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => {
                          setShowReschedule(false);
                          setRescheduleError(null);
                        }}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Customer: cancel booking */}
          {!isProvider && (booking.status === "PENDING" || booking.status === "CONFIRMED") && (
            <Card className="border-error-200">
              <CardContent className="py-4">
                <Button
                  variant="outline"
                  className="w-full text-error-600 hover:bg-error-50"
                  onClick={() => setConfirmCancel(true)}
                  isLoading={isUpdating}
                >
                  <XCircle className="mr-2 h-4 w-4" />
                  Cancel Booking
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={confirmCancel}
        onOpenChange={setConfirmCancel}
        title="Cancel this booking?"
        description="The provider will be notified. This can't be undone."
        confirmLabel="Yes, cancel"
        cancelLabel="Keep booking"
        destructive
        isLoading={isUpdating}
        onConfirm={() =>
          handleStatusUpdate("CANCELLED", {
            cancelReason: isProvider ? "Cancelled by provider" : "Cancelled by customer",
          })
        }
      />

      <ConfirmDialog
        open={confirmDecline}
        onOpenChange={setConfirmDecline}
        title="Decline this booking?"
        description="The customer will be notified that you can't take this job."
        confirmLabel="Decline"
        cancelLabel="Keep pending"
        destructive
        isLoading={isUpdating}
        onConfirm={() =>
          handleStatusUpdate("CANCELLED", { cancelReason: "Declined by provider" })
        }
      />

      {showConfirmTime && booking && (
        <Dialog open={showConfirmTime} onOpenChange={setShowConfirmTime}>
          <DialogContent onClose={() => setShowConfirmTime(false)}>
            <DialogHeader>
              <DialogTitle>Confirm flexible-time booking</DialogTitle>
              <DialogDescription>
                Pick a start time agreed with the customer, or skip to confirm
                without locking a time yet.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <input
                type="time"
                value={confirmTime}
                onChange={(e) => setConfirmTime(e.target.value)}
                className="w-full rounded-xl border-2 border-gray-200 px-4 py-2.5 text-sm text-gray-900 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
              />
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() =>
                  handleStatusUpdate("CONFIRMED", { scheduledStartTime: undefined })
                }
                disabled={isUpdating}
              >
                Skip — confirm flexible
              </Button>
              <Button
                onClick={() =>
                  handleStatusUpdate("CONFIRMED", {
                    scheduledStartTime: confirmTime
                      ? `${confirmTime}:00`
                      : undefined,
                  })
                }
                isLoading={isUpdating}
              >
                Confirm
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
