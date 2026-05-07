"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ExternalLink, XCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";
import { useRequireRole } from "@/hooks";
import { adminService } from "@/lib/api/admin";
import { formatCurrency, formatDate, formatTime } from "@/lib/utils";
import type { Booking, BookingStatus } from "@/types";

const STATUS_VARIANT: Record<BookingStatus, "default" | "warning" | "success" | "error" | "info"> = {
  PENDING: "warning",
  CONFIRMED: "info",
  IN_PROGRESS: "info",
  COMPLETED: "success",
  CANCELLED: "error",
};

export default function AdminBookingsPage() {
  const { isLoading: authLoading, hasRole } = useRequireRole(["ADMIN"]);
  const { toast } = useToast();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<BookingStatus | "ALL">("ALL");
  const [busy, setBusy] = useState<string | null>(null);
  const [cancelTarget, setCancelTarget] = useState<Booking | null>(null);
  const [reason, setReason] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: { limit: number; status?: string } = { limit: 50 };
      if (status !== "ALL") params.status = status;
      const res = await adminService.getBookings(params);
      setBookings(res.bookings || []);
    } catch (err) {
      toast({
        variant: "error",
        title: "Failed to load bookings",
        description: err instanceof Error ? err.message : "Try again.",
      });
    } finally {
      setLoading(false);
    }
  }, [status, toast]);

  useEffect(() => {
    if (!hasRole) return;
    void load();
  }, [hasRole, load]);

  const handleCancel = async () => {
    if (!cancelTarget) return;
    setBusy(cancelTarget.id);
    try {
      await adminService.cancelBooking(cancelTarget.id, reason.trim() || "Cancelled by admin");
      toast({ variant: "success", title: "Booking cancelled" });
      setCancelTarget(null);
      setReason("");
      await load();
    } catch (err) {
      toast({
        variant: "error",
        title: "Cancel failed",
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
        <h1 className="text-2xl font-bold text-secondary-900">Bookings</h1>
        <p className="mt-1 text-secondary-600">Cross-platform activity and force-cancel.</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {(["ALL", "PENDING", "CONFIRMED", "IN_PROGRESS", "COMPLETED", "CANCELLED"] as const).map(
          (s) => (
            <button
              key={s}
              onClick={() => setStatus(s)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
                status === s
                  ? "bg-primary-600 text-white"
                  : "bg-white text-secondary-700 hover:bg-secondary-100"
              }`}
            >
              {s}
            </button>
          ),
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Spinner size="lg" />
        </div>
      ) : bookings.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-secondary-500">
            No bookings.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {bookings.map((b) => (
            <Card key={b.id}>
              <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold text-secondary-900">#{b.bookingNumber}</p>
                    <Badge variant={STATUS_VARIANT[b.status]}>{b.status}</Badge>
                    <Badge variant="outline">{b.paymentStatus}</Badge>
                  </div>
                  <p className="text-sm text-secondary-700">
                    {b.customer?.name} → {b.provider?.user?.name}
                  </p>
                  <p className="text-xs text-secondary-500">
                    {formatDate(b.scheduledDate)}
                    {b.scheduledStartTime && ` · ${formatTime(b.scheduledStartTime)}`}
                    {b.finalAmount ? ` · ${formatCurrency(Number(b.finalAmount))}` : ""}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button asChild variant="outline" size="sm">
                    <Link href={`/bookings/${b.id}`} target="_blank">
                      View <ExternalLink className="ml-1 h-3 w-3" />
                    </Link>
                  </Button>
                  {b.status !== "CANCELLED" && b.status !== "COMPLETED" && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCancelTarget(b)}
                      disabled={busy === b.id}
                    >
                      <XCircle className="mr-1 h-4 w-4" />
                      Force cancel
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={!!cancelTarget}
        onOpenChange={(o) => {
          if (!o) {
            setCancelTarget(null);
            setReason("");
          }
        }}
        title={`Cancel booking #${cancelTarget?.bookingNumber}?`}
        description="Both parties will be notified. Provide a reason — it stays on the booking record."
        confirmLabel="Cancel booking"
        destructive
        isLoading={busy === cancelTarget?.id}
        onConfirm={handleCancel}
      />
      {cancelTarget && (
        <div className="fixed inset-x-0 bottom-24 z-[60] mx-auto max-w-md px-4">
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Reason (visible to both parties)…"
            rows={3}
            className="w-full rounded-xl border-2 border-gray-200 bg-white px-4 py-2 text-sm shadow-lg focus:border-primary-500 focus:outline-none"
          />
        </div>
      )}
    </div>
  );
}
