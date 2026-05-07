"use client";

import { useCallback, useEffect, useState } from "react";
import { Star, Eye, EyeOff, Trash2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";
import { useRequireRole } from "@/hooks";
import { adminService } from "@/lib/api/admin";
import type { Review } from "@/types";

type Action = "approve" | "hide" | "delete";

export default function AdminReviewsPage() {
  const { isLoading: authLoading, hasRole } = useRequireRole(["ADMIN"]);
  const { toast } = useToast();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [pending, setPending] = useState<{ review: Review; action: Action } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminService.getReportedReviews({ limit: 50 });
      setReviews(res.reviews || []);
    } catch (err) {
      toast({
        variant: "error",
        title: "Failed to load reports",
        description: err instanceof Error ? err.message : "Try again.",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (!hasRole) return;
    void load();
  }, [hasRole, load]);

  const confirm = async () => {
    if (!pending) return;
    setBusy(pending.review.id);
    try {
      await adminService.moderateReview(pending.review.id, pending.action);
      toast({
        variant: "success",
        title:
          pending.action === "approve"
            ? "Review approved"
            : pending.action === "hide"
              ? "Review hidden"
              : "Review deleted",
      });
      setReviews((prev) => prev.filter((r) => r.id !== pending.review.id));
      setPending(null);
    } catch (err) {
      toast({
        variant: "error",
        title: "Action failed",
        description: err instanceof Error ? err.message : "Try again.",
      });
    } finally {
      setBusy(null);
    }
  };

  if (authLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner size="lg" />
      </div>
    );
  }
  if (!hasRole) return null;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-secondary-900">Review moderation</h1>
        <p className="mt-1 text-secondary-600">
          Reports filed by users. Approve to keep, hide to remove from public view, or delete.
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Spinner size="lg" />
        </div>
      ) : reviews.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-secondary-500">
            No reports — everything has been triaged.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {reviews.map((r) => (
            <Card key={r.id}>
              <CardContent className="space-y-3 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex">
                    {Array.from({ length: 5 }, (_, i) => (
                      <Star
                        key={i}
                        className={`h-4 w-4 ${
                          i < r.rating ? "fill-warning-500 text-warning-500" : "text-secondary-300"
                        }`}
                      />
                    ))}
                  </div>
                  <Badge variant="warning">Reported</Badge>
                  {!r.isVisible && <Badge variant="error">Hidden</Badge>}
                </div>
                {r.title && (
                  <p className="font-semibold text-secondary-900">{r.title}</p>
                )}
                <p className="text-sm text-secondary-700">{r.comment}</p>
                <p className="text-xs text-secondary-500">
                  by {r.customer?.name} · provider {r.provider?.user?.name}
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPending({ review: r, action: "approve" })}
                    disabled={busy === r.id}
                  >
                    <Eye className="mr-1 h-4 w-4" />
                    Approve (keep visible)
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPending({ review: r, action: "hide" })}
                    disabled={busy === r.id}
                  >
                    <EyeOff className="mr-1 h-4 w-4" />
                    Hide
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPending({ review: r, action: "delete" })}
                    disabled={busy === r.id}
                  >
                    <Trash2 className="mr-1 h-4 w-4" />
                    Delete
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={!!pending}
        onOpenChange={(o) => {
          if (!o) setPending(null);
        }}
        title={
          pending?.action === "approve"
            ? "Keep this review visible?"
            : pending?.action === "hide"
              ? "Hide this review?"
              : "Delete this review?"
        }
        description={
          pending?.action === "delete"
            ? "This soft-deletes the review and clears the report flag."
            : "Action will be logged in the audit trail."
        }
        confirmLabel={
          pending?.action === "approve"
            ? "Approve"
            : pending?.action === "hide"
              ? "Hide"
              : "Delete"
        }
        destructive={pending?.action !== "approve"}
        isLoading={busy === pending?.review.id}
        onConfirm={confirm}
      />
    </div>
  );
}
