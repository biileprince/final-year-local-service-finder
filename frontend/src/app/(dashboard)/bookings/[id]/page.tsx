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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { Spinner } from "@/components/ui/spinner";
import { useAuth } from "@/hooks";
import { bookingsService, reviewsService } from "@/lib/api";
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
  PENDING: {
    label: "Pending Confirmation",
    variant: "warning",
    icon: AlertCircle,
  },
  CONFIRMED: { label: "Confirmed", variant: "info", icon: CheckCircle },
  IN_PROGRESS: { label: "In Progress", variant: "default", icon: Clock },
  COMPLETED: { label: "Completed", variant: "success", icon: CheckCircle },
  CANCELLED: { label: "Cancelled", variant: "error", icon: XCircle },
};

export default function BookingDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const [booking, setBooking] = useState<Booking | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState("");

  useEffect(() => {
    if (params.id) {
      loadBooking(params.id as string);
    }
  }, [params.id]);

  const loadBooking = async (id: string) => {
    setIsLoading(true);
    try {
      const data = await bookingsService.getById(id);
      setBooking(data);
    } catch (error) {
      console.error("Failed to load booking:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleStatusUpdate = async (newStatus: BookingStatus) => {
    if (!booking) return;
    setIsUpdating(true);
    try {
      const updated = await bookingsService.updateStatus(booking.id, newStatus);
      setBooking(updated);
    } catch (error) {
      console.error("Failed to update booking status:", error);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleSubmitReview = async () => {
    if (!booking) return;
    setIsUpdating(true);
    try {
      await reviewsService.create({
        bookingId: booking.id,
        rating: reviewRating,
        comment: reviewComment,
      });
      setShowReviewForm(false);
      loadBooking(booking.id);
    } catch (error) {
      console.error("Failed to submit review:", error);
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
        <h1 className="text-2xl font-bold text-secondary-900">
          Booking not found
        </h1>
        <p className="text-secondary-600">
          The booking you are looking for does not exist.
        </p>
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
            <Button variant="outline">
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
              <CardTitle>
                {isProvider ? "Customer" : "Service Provider"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4">
                <Avatar
                  size="lg"
                  src={otherUser?.profileImage}
                  name={otherUser?.name}
                />
                <div>
                  <h3 className="font-semibold text-secondary-900">
                    {otherUser?.name}
                  </h3>
                  <p className="text-sm text-secondary-500">
                    {otherUser?.email}
                  </p>
                  {otherUser?.phone && (
                    <p className="text-sm text-secondary-500">
                      {otherUser?.phone}
                    </p>
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
                  <p className="text-secondary-600">
                    {formatDate(booking.scheduledDate)}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Clock className="mt-0.5 h-5 w-5 text-secondary-400" />
                <div>
                  <p className="font-medium text-secondary-900">Time</p>
                  <p className="text-secondary-600">
                    {formatTime(booking.scheduledStartTime)}
                    {booking.scheduledEndTime &&
                      ` - ${formatTime(booking.scheduledEndTime)}`}
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
                  <p className="mt-1 text-secondary-600">
                    {booking.problemDescription}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Provider Actions */}
          {isProvider && booking.status === "PENDING" && (
            <Card>
              <CardHeader>
                <CardTitle>Respond to Booking</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="mb-4 text-secondary-600">
                  Please confirm or decline this booking request.
                </p>
                <div className="flex gap-3">
                  <Button
                    onClick={() => handleStatusUpdate("CONFIRMED")}
                    isLoading={isUpdating}
                  >
                    <CheckCircle className="mr-2 h-4 w-4" />
                    Confirm Booking
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => handleStatusUpdate("CANCELLED")}
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
                <Button
                  onClick={() => handleStatusUpdate("IN_PROGRESS")}
                  isLoading={isUpdating}
                >
                  Start Service
                </Button>
              </CardContent>
            </Card>
          )}

          {isProvider && booking.status === "IN_PROGRESS" && (
            <Card>
              <CardContent className="py-4">
                <Button
                  onClick={() => handleStatusUpdate("COMPLETED")}
                  isLoading={isUpdating}
                >
                  <CheckCircle className="mr-2 h-4 w-4" />
                  Mark as Completed
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Customer Review */}
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
                    <div>
                      <label className="mb-2 block text-sm font-medium text-secondary-700">
                        Rating
                      </label>
                      <div className="flex gap-1">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <button
                            key={star}
                            onClick={() => setReviewRating(star)}
                            className="p-1"
                          >
                            <Star
                              className={cn(
                                "h-8 w-8",
                                star <= reviewRating
                                  ? "fill-warning-500 text-warning-500"
                                  : "fill-secondary-200 text-secondary-200",
                              )}
                            />
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="mb-2 block text-sm font-medium text-secondary-700">
                        Comment (optional)
                      </label>
                      <textarea
                        value={reviewComment}
                        onChange={(e) => setReviewComment(e.target.value)}
                        rows={4}
                        className="w-full rounded-lg border border-secondary-300 px-3 py-2 text-secondary-900 placeholder:text-secondary-400 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                        placeholder="Share your experience..."
                      />
                    </div>
                    <div className="flex gap-3">
                      <Button
                        onClick={handleSubmitReview}
                        isLoading={isUpdating}
                      >
                        Submit Review
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => setShowReviewForm(false)}
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
                <div className="flex items-center gap-1 mb-2">
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

        {/* Sidebar - Payment Info */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Payment Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {booking.estimatedAmount && (
                <div className="flex justify-between">
                  <span className="text-secondary-600">Estimated Amount</span>
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
              {booking.paymentStatus && (
                <div className="flex justify-between">
                  <span className="text-secondary-600">Payment Status</span>
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
            </CardContent>
          </Card>

          {!isProvider &&
            (booking.status === "PENDING" ||
              booking.status === "CONFIRMED") && (
              <Card className="border-error-200">
                <CardContent className="py-4">
                  <Button
                    variant="outline"
                    className="w-full text-error-600 hover:bg-error-50"
                    onClick={() => handleStatusUpdate("CANCELLED")}
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
    </div>
  );
}
