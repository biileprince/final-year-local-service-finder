"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { Spinner } from "@/components/ui/spinner";
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
import { bookingsService, reviewsService, messagesService } from "@/lib/api";
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

  const { toast } = useToast();

  // Payment recording state
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [paymentReference, setPaymentReference] = useState("");
  const [paymentError, setPaymentError] = useState<string | null>(null);

  useEffect(() => {
    if (params.id) loadBooking(params.id as string);
  }, [params.id]);

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
      });
      setShowReviewForm(false);
      setReviewComment("");
      loadBooking(booking.id);
    } catch (err) {
      setReviewError(
        err instanceof Error ? err.message : "Failed to submit review.",
      );
    } finally {
      setIsUpdating(false);
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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner size="lg" />
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
          <div className="flex gap-2">
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
                <div>
                  <p className="font-medium text-secondary-900">Location</p>
                  <p className="text-secondary-600">{booking.serviceAddress}</p>
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
                        className="w-full rounded-xl border-2 border-gray-200 px-4 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
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
            <Card>
              <CardHeader>
                <CardTitle>Leave a Review</CardTitle>
              </CardHeader>
              <CardContent>
                {!showReviewForm ? (
                  <Button onClick={() => setShowReviewForm(true)}>
                    <Star className="mr-2 h-4 w-4" />
                    Write a Review
                  </Button>
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
                        Comment <span className="text-secondary-400">(min 10 chars)</span>
                      </label>
                      <textarea
                        value={reviewComment}
                        onChange={(e) => setReviewComment(e.target.value)}
                        rows={4}
                        className="w-full rounded-xl border-2 border-gray-200 px-4 py-3 text-sm text-secondary-900 placeholder:text-secondary-400 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                        placeholder="Share your experience…"
                      />
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
