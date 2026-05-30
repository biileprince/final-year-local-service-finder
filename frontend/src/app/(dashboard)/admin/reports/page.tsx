"use client";

import { useCallback, useEffect, useState } from "react";
import { Flag, CheckCircle2, XCircle, ShieldAlert } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";
import { useRequireRole } from "@/hooks";
import {
  adminService,
  type UserReport,
  type ReportStatus,
} from "@/lib/api/admin";
import { formatRelativeTime } from "@/lib/utils";

type ResolveAction = Exclude<ReportStatus, "PENDING">;

const STATUS_FILTERS: { label: string; value: ReportStatus | "ALL" }[] = [
  { label: "Pending", value: "PENDING" },
  { label: "Reviewed", value: "REVIEWED" },
  { label: "Actioned", value: "ACTIONED" },
  { label: "Dismissed", value: "DISMISSED" },
  { label: "All", value: "ALL" },
];

const STATUS_BADGE: Record<
  ReportStatus,
  "warning" | "success" | "error" | "secondary"
> = {
  PENDING: "warning",
  REVIEWED: "secondary",
  ACTIONED: "success",
  DISMISSED: "error",
};

const REASON_LABEL: Record<UserReport["reason"], string> = {
  SPAM: "Spam",
  HARASSMENT: "Harassment",
  INAPPROPRIATE: "Inappropriate content",
  SCAM: "Scam / fraud",
  OTHER: "Other",
};

export default function AdminReportsPage() {
  const { isLoading: authLoading, hasRole } = useRequireRole(["ADMIN"]);
  const { toast } = useToast();
  const [reports, setReports] = useState<UserReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<ReportStatus | "ALL">("PENDING");
  const [busy, setBusy] = useState<string | null>(null);
  const [pending, setPending] = useState<{
    report: UserReport;
    action: ResolveAction;
  } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminService.getReports(
        filter === "ALL" ? undefined : filter,
      );
      setReports(res || []);
    } catch (err) {
      toast({
        variant: "error",
        title: "Failed to load reports",
        description: err instanceof Error ? err.message : "Try again.",
      });
    } finally {
      setLoading(false);
    }
  }, [filter, toast]);

  useEffect(() => {
    if (!hasRole) return;
    void load();
  }, [hasRole, load]);

  const confirm = async () => {
    if (!pending) return;
    setBusy(pending.report.id);
    try {
      await adminService.resolveReport(pending.report.id, pending.action);
      toast({
        variant: "success",
        title:
          pending.action === "ACTIONED"
            ? "Report actioned"
            : pending.action === "DISMISSED"
              ? "Report dismissed"
              : "Report marked reviewed",
      });
      // Drop it from the list unless we're viewing everything.
      setReports((prev) =>
        filter === "ALL"
          ? prev.map((r) =>
              r.id === pending.report.id
                ? { ...r, status: pending.action }
                : r,
            )
          : prev.filter((r) => r.id !== pending.report.id),
      );
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
        <h1 className="text-2xl font-bold text-secondary-900">User reports</h1>
        <p className="mt-1 text-secondary-600">
          Reports filed from chat. Review the context, then action against the
          reported user, dismiss, or mark reviewed.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {STATUS_FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            onClick={() => setFilter(f.value)}
            className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
              filter === f.value
                ? "bg-primary-600 text-white"
                : "bg-secondary-100 text-secondary-700 hover:bg-secondary-200"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Spinner size="lg" />
        </div>
      ) : reports.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-secondary-500">
            No reports in this view — everything has been triaged.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {reports.map((r) => {
            const resolved = r.status !== "PENDING";
            return (
              <Card key={r.id}>
                <CardContent className="space-y-3 p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <Flag className="h-4 w-4 text-error-600" />
                    <Badge variant={STATUS_BADGE[r.status]}>{r.status}</Badge>
                    <span className="text-sm font-semibold text-secondary-900">
                      {REASON_LABEL[r.reason]}
                    </span>
                    <span className="text-xs text-secondary-500">
                      · {formatRelativeTime(r.createdAt)}
                    </span>
                  </div>

                  {r.details && (
                    <p className="rounded-lg bg-secondary-50 p-3 text-sm text-secondary-700">
                      {r.details}
                    </p>
                  )}

                  <div className="grid gap-1 text-xs text-secondary-500 sm:grid-cols-2">
                    <p>
                      Reported user:{" "}
                      <span className="font-medium text-secondary-700">
                        {r.reported?.name ?? "Unknown"}
                      </span>{" "}
                      {r.reported?.email && `(${r.reported.email})`}
                    </p>
                    <p>
                      Filed by:{" "}
                      <span className="font-medium text-secondary-700">
                        {r.reporter?.name ?? "Unknown"}
                      </span>
                    </p>
                  </div>

                  {resolved && r.resolutionNote && (
                    <p className="text-xs text-secondary-500">
                      Resolution note: {r.resolutionNote}
                    </p>
                  )}

                  {!resolved && (
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          setPending({ report: r, action: "ACTIONED" })
                        }
                        disabled={busy === r.id}
                      >
                        <ShieldAlert className="mr-1 h-4 w-4" />
                        Action
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          setPending({ report: r, action: "REVIEWED" })
                        }
                        disabled={busy === r.id}
                      >
                        <CheckCircle2 className="mr-1 h-4 w-4" />
                        Mark reviewed
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          setPending({ report: r, action: "DISMISSED" })
                        }
                        disabled={busy === r.id}
                      >
                        <XCircle className="mr-1 h-4 w-4" />
                        Dismiss
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <ConfirmDialog
        open={!!pending}
        onOpenChange={(o) => {
          if (!o) setPending(null);
        }}
        title={
          pending?.action === "ACTIONED"
            ? "Action this report?"
            : pending?.action === "DISMISSED"
              ? "Dismiss this report?"
              : "Mark this report reviewed?"
        }
        description="The outcome is recorded on the report and the reporter is treated as handled."
        confirmLabel={
          pending?.action === "ACTIONED"
            ? "Action"
            : pending?.action === "DISMISSED"
              ? "Dismiss"
              : "Mark reviewed"
        }
        destructive={pending?.action === "ACTIONED"}
        isLoading={busy === pending?.report.id}
        onConfirm={confirm}
      />
    </div>
  );
}
