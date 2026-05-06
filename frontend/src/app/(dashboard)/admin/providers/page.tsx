"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ShieldCheck, ShieldX, ExternalLink } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";
import { useRequireRole } from "@/hooks";
import { adminService } from "@/lib/api";
import type { Provider } from "@/types";

export default function AdminVerificationQueuePage() {
  const { isLoading: authLoading, hasRole } = useRequireRole(["ADMIN"]);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [rejectTarget, setRejectTarget] = useState<Provider | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const { toast } = useToast();

  useEffect(() => {
    if (!hasRole) return;
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasRole]);

  const load = async () => {
    setLoading(true);
    try {
      const res = await adminService.getPendingVerifications({ limit: 50 });
      const items =
        "items" in res ? res.items : (res as { data: Provider[] }).data;
      setProviders(items || []);
    } catch (err) {
      toast({
        variant: "error",
        title: "Failed to load queue",
        description: err instanceof Error ? err.message : "Try again.",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (provider: Provider) => {
    setBusy(provider.id);
    try {
      await adminService.verifyProvider(provider.id);
      setProviders((prev) => prev.filter((p) => p.id !== provider.id));
      toast({ variant: "success", title: "Provider verified" });
    } catch (err) {
      toast({
        variant: "error",
        title: "Verify failed",
        description: err instanceof Error ? err.message : "Try again.",
      });
    } finally {
      setBusy(null);
    }
  };

  const handleReject = async () => {
    if (!rejectTarget) return;
    setBusy(rejectTarget.id);
    try {
      await adminService.rejectProvider(rejectTarget.id, rejectReason.trim());
      setProviders((prev) => prev.filter((p) => p.id !== rejectTarget.id));
      toast({ variant: "success", title: "Provider rejected" });
      setRejectTarget(null);
      setRejectReason("");
    } catch (err) {
      toast({
        variant: "error",
        title: "Reject failed",
        description: err instanceof Error ? err.message : "Try again.",
      });
    } finally {
      setBusy(null);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!hasRole) return null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-secondary-900">
          Provider verification queue
        </h1>
        <p className="mt-1 text-secondary-600">
          Review provider profiles and approve or reject their verification.
        </p>
      </div>

      {providers.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <ShieldCheck className="mx-auto h-12 w-12 text-secondary-300" />
            <p className="mt-4 text-secondary-500">
              Nothing pending — you're all caught up.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {providers.map((p) => (
            <Card key={p.id}>
              <CardHeader className="flex-row items-center justify-between gap-4">
                <div className="min-w-0">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    {p.user?.name || "Unnamed provider"}
                    <Badge variant="warning">Pending</Badge>
                  </CardTitle>
                  <p className="text-xs text-secondary-500">{p.user?.email}</p>
                </div>
                <Button variant="ghost" size="sm" asChild>
                  <Link href={`/providers/${p.id}`} target="_blank">
                    View profile
                    <ExternalLink className="ml-1 h-3 w-3" />
                  </Link>
                </Button>
              </CardHeader>
              <CardContent className="space-y-3">
                {p.bio && (
                  <p className="text-sm text-secondary-700">{p.bio}</p>
                )}
                <div className="flex flex-wrap gap-2 text-xs text-secondary-500">
                  {p.location && <span>📍 {p.location}</span>}
                  {p.yearsExperience !== undefined && (
                    <span>· {p.yearsExperience} yr experience</span>
                  )}
                  {p.categories && p.categories.length > 0 && (
                    <span>
                      ·{" "}
                      {p.categories.map((c) => c.category.name).join(", ")}
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    onClick={() => handleVerify(p)}
                    isLoading={busy === p.id}
                  >
                    <ShieldCheck className="mr-2 h-4 w-4" />
                    Approve
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setRejectTarget(p)}
                    disabled={busy === p.id}
                  >
                    <ShieldX className="mr-2 h-4 w-4" />
                    Reject
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={!!rejectTarget}
        onOpenChange={(o) => {
          if (!o) {
            setRejectTarget(null);
            setRejectReason("");
          }
        }}
        title={`Reject ${rejectTarget?.user?.name || "provider"}?`}
        description="Add a reason — it will be sent to the provider so they can fix and re-submit."
        confirmLabel="Reject"
        destructive
        isLoading={busy === rejectTarget?.id}
        onConfirm={handleReject}
      />
      {rejectTarget && (
        <div className="fixed inset-x-0 bottom-24 z-[60] mx-auto max-w-md px-4">
          <textarea
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="Reason (visible to the provider)…"
            rows={3}
            className="w-full rounded-xl border-2 border-gray-200 bg-white px-4 py-2 text-sm shadow-lg focus:border-primary-500 focus:outline-none"
          />
        </div>
      )}
    </div>
  );
}
