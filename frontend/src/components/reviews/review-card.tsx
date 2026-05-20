"use client";

import { useState } from "react";
import Image from "next/image";
import { Star, ThumbsUp, Flag, MessageSquare } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";
import { reviewsService } from "@/lib/api";
import { formatRelativeTime } from "@/lib/utils";
import type { Review } from "@/types";

interface ReviewCardProps {
  review: Review;
  /** When true, shows a "Reply" affordance for the provider whose review this is. */
  canReply?: boolean;
}

export function ReviewCard({ review: initial, canReply }: ReviewCardProps) {
  const { toast } = useToast();
  const [review, setReview] = useState<Review>(initial);
  const [helpful, setHelpful] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState("");
  const [busy, setBusy] = useState<"helpful" | "report" | "reply" | null>(null);
  const [replyOpen, setReplyOpen] = useState(false);
  const [replyText, setReplyText] = useState("");

  const handleHelpful = async () => {
    if (helpful) return;
    setBusy("helpful");
    try {
      await reviewsService.markHelpful(review.id);
      setHelpful(true);
      setReview((r) => ({ ...r, helpfulCount: (r.helpfulCount ?? 0) + 1 }));
    } catch (err) {
      toast({
        variant: "error",
        title: "Couldn't mark helpful",
        description: err instanceof Error ? err.message : "Try again.",
      });
    } finally {
      setBusy(null);
    }
  };

  const handleReport = async () => {
    setBusy("report");
    try {
      await reviewsService.report(review.id, reportReason.trim() || "Inappropriate");
      toast({ variant: "success", title: "Report submitted" });
      setReportOpen(false);
      setReportReason("");
    } catch (err) {
      toast({
        variant: "error",
        title: "Report failed",
        description: err instanceof Error ? err.message : "Try again.",
      });
    } finally {
      setBusy(null);
    }
  };

  const handleReply = async () => {
    if (!replyText.trim()) return;
    setBusy("reply");
    try {
      const updated = await reviewsService.addProviderResponse(
        review.id,
        replyText.trim(),
      );
      setReview((r) => ({
        ...r,
        providerResponse: updated.providerResponse ?? replyText.trim(),
        providerRespondedAt:
          updated.providerRespondedAt ?? new Date().toISOString(),
      }));
      setReplyOpen(false);
      setReplyText("");
      toast({ variant: "success", title: "Response posted" });
    } catch (err) {
      toast({
        variant: "error",
        title: "Couldn't post response",
        description: err instanceof Error ? err.message : "Try again.",
      });
    } finally {
      setBusy(null);
    }
  };

  return (
    <Card>
      <CardContent className="space-y-3 p-6">
        <div className="flex items-start gap-4">
          <Avatar
            src={review.customer?.profileImage}
            name={review.customer?.name}
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <h4 className="truncate font-medium text-secondary-900">
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
            {review.title && (
              <p className="mt-2 font-semibold text-secondary-900">
                {review.title}
              </p>
            )}
            {review.comment && (
              <p className="mt-2 text-secondary-700">{review.comment}</p>
            )}
            {review.images && review.images.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {review.images.map((img) => (
                  <Image
                    key={img.id}
                    src={img.file.thumbnailUrl || img.file.url}
                    alt={img.caption || "Review image"}
                    width={80}
                    height={80}
                    sizes="80px"
                    className="h-20 w-20 rounded-lg object-cover"
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Provider response */}
        {review.providerResponse && (
          <div className="ml-14 rounded-xl bg-primary-50 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-primary-700">
              Response from provider
            </p>
            <p className="mt-1 text-sm text-secondary-700">
              {review.providerResponse}
            </p>
            {review.providerRespondedAt && (
              <p className="mt-1 text-xs text-secondary-500">
                {formatRelativeTime(review.providerRespondedAt)}
              </p>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="ml-14 flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant="ghost"
            onClick={handleHelpful}
            disabled={busy === "helpful" || helpful}
            className="text-secondary-600"
          >
            <ThumbsUp
              className={`mr-1 h-4 w-4 ${helpful ? "fill-primary-500 text-primary-500" : ""}`}
            />
            Helpful{review.helpfulCount > 0 ? ` · ${review.helpfulCount}` : ""}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setReportOpen(true)}
            disabled={busy === "report"}
            className="text-secondary-600"
          >
            <Flag className="mr-1 h-4 w-4" />
            Report
          </Button>
          {canReply && !review.providerResponse && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setReplyOpen(true)}
              disabled={busy === "reply"}
            >
              <MessageSquare className="mr-1 h-4 w-4" />
              Reply
            </Button>
          )}
        </div>

        {/* Reply composer */}
        {replyOpen && (
          <div className="ml-14 space-y-2 rounded-xl border-2 border-primary-200 bg-white p-3">
            <textarea
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              placeholder="Thanks for the review…"
              rows={3}
              className="w-full rounded-lg border border-secondary-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none"
            />
            <div className="flex justify-end gap-2">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setReplyOpen(false);
                  setReplyText("");
                }}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleReply}
                isLoading={busy === "reply"}
                disabled={!replyText.trim()}
              >
                Post response
              </Button>
            </div>
          </div>
        )}

        {/* Report dialog */}
        <ConfirmDialog
          open={reportOpen}
          onOpenChange={(o) => {
            if (!o) {
              setReportOpen(false);
              setReportReason("");
            }
          }}
          title="Report this review?"
          description="An admin will review your report. Reviews remain visible until moderated."
          confirmLabel="Submit report"
          isLoading={busy === "report"}
          onConfirm={handleReport}
        />
        {reportOpen && (
          <div className="fixed inset-x-0 bottom-24 z-[60] mx-auto max-w-md px-4">
            <textarea
              value={reportReason}
              onChange={(e) => setReportReason(e.target.value)}
              placeholder="Reason (e.g., spam, abusive, off-topic)…"
              rows={3}
              className="w-full rounded-xl border-2 border-gray-200 bg-white px-4 py-2 text-sm shadow-lg focus:border-primary-500 focus:outline-none"
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
