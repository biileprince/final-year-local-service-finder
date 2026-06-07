"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  ShieldCheck,
  ShieldX,
  ExternalLink,
  ChevronDown,
  FileText,
  ImageIcon,
  Mail,
  Phone,
  MapPin,
  Clock,
  Tag,
  Sparkles,
  Briefcase,
  Eye,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";
import { useRequireRole } from "@/hooks";
import { adminService } from "@/lib/api";
import type { Provider } from "@/types";
import { cn } from "@/lib/utils";

export default function AdminVerificationQueuePage() {
  const { isLoading: authLoading, hasRole } = useRequireRole(["ADMIN"]);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [rejectTarget, setRejectTarget] = useState<Provider | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  // Single-open expansion model — only one provider's full details visible
  // at a time so the page stays scannable. Click-to-toggle.
  const [expandedId, setExpandedId] = useState<string | null>(null);
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
        "items" in res ? res.items : "providers" in res ? res.providers : [];
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
          {providers.map((p) => {
            const isExpanded = expandedId === p.id;
            const docCount =
              (p.idDocumentId ? 1 : 0) + (p.businessLicenseId ? 1 : 0);
            return (
              <Card key={p.id} className={cn(isExpanded && "ring-2 ring-primary-200")}>
                <CardHeader className="flex-row items-center justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <CardTitle className="flex flex-wrap items-center gap-2 text-lg">
                      {p.user?.name || "Unnamed provider"}
                      <Badge variant="warning">Pending</Badge>
                      {docCount > 0 && (
                        <Badge variant="default" className="gap-1">
                          <FileText className="h-3 w-3" />
                          {docCount} doc{docCount === 1 ? "" : "s"}
                        </Badge>
                      )}
                    </CardTitle>
                    <p className="text-xs text-secondary-500">{p.user?.email}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setExpandedId(isExpanded ? null : p.id)}
                      aria-expanded={isExpanded}
                      aria-controls={`provider-details-${p.id}`}
                    >
                      <Eye className="mr-1.5 h-4 w-4" />
                      {isExpanded ? "Hide details" : "View details"}
                      <ChevronDown
                        className={cn(
                          "ml-1 h-4 w-4 transition-transform",
                          isExpanded && "rotate-180",
                        )}
                      />
                    </Button>
                    <Button variant="ghost" size="sm" asChild title="Open public profile">
                      <Link href={`/providers/${p.id}`} target="_blank">
                        <ExternalLink className="h-4 w-4" />
                      </Link>
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {/* Brief summary always visible — admin can scan the queue
                      without expanding every row. */}
                  {p.bio && (
                    <p className="line-clamp-2 text-sm text-secondary-700">
                      {p.bio}
                    </p>
                  )}
                  <div className="flex flex-wrap gap-2 text-xs text-secondary-500">
                    {p.location && (
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="h-3 w-3" /> {p.location}
                      </span>
                    )}
                    {p.yearsExperience !== undefined && (
                      <span className="inline-flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {p.yearsExperience} yr experience
                      </span>
                    )}
                    {p.categories && p.categories.length > 0 && (
                      <span className="inline-flex items-center gap-1">
                        <Tag className="h-3 w-3" />
                        {p.categories.map((c) => c.category.name).join(", ")}
                      </span>
                    )}
                  </div>

                  {/* Expanded "View details" panel — registration record,
                      documents preview, gallery, specialties. */}
                  {isExpanded && (
                    <div
                      id={`provider-details-${p.id}`}
                      className="space-y-4 rounded-xl border-2 border-primary-100 bg-primary-50/30 p-4"
                    >
                      <ProviderDetailGrid provider={p} />
                      <ProviderDocumentList provider={p} />
                      {p.specialties && p.specialties.length > 0 && (
                        <ProviderSpecialtiesBlock
                          specialties={p.specialties.map((s) => s.specialty)}
                        />
                      )}
                      {p.gallery && p.gallery.length > 0 && (
                        <ProviderGalleryBlock gallery={p.gallery} />
                      )}
                    </div>
                  )}

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
            );
          })}
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

// ─── Detail sub-components (admin "View details" panel) ─────────────────────

function ProviderDetailGrid({ provider }: { provider: Provider }) {
  const rows: Array<{ icon: React.ComponentType<{ className?: string }>; label: string; value: string | null }> = [
    { icon: Mail, label: "Email", value: provider.user?.email || null },
    { icon: Phone, label: "Phone", value: provider.user?.phone || null },
    { icon: MapPin, label: "Location", value: provider.location || null },
    {
      icon: Clock,
      label: "Experience",
      value:
        provider.yearsExperience !== undefined
          ? `${provider.yearsExperience} year${provider.yearsExperience === 1 ? "" : "s"}`
          : null,
    },
    {
      icon: Briefcase,
      label: "Categories",
      value:
        provider.categories && provider.categories.length > 0
          ? provider.categories.map((c) => c.category.name).join(", ")
          : null,
    },
    {
      icon: MapPin,
      label: "Service radius",
      value: provider.serviceRadiusKm ? `${provider.serviceRadiusKm} km` : null,
    },
  ];
  return (
    <div>
      <h4 className="mb-2 text-xs font-bold uppercase tracking-wider text-secondary-500">
        Registration details
      </h4>
      <dl className="grid gap-3 sm:grid-cols-2">
        {rows.map((r) => (
          <div key={r.label} className="flex items-start gap-2">
            <r.icon className="mt-0.5 h-4 w-4 shrink-0 text-primary-600" />
            <div className="min-w-0">
              <dt className="text-[11px] font-bold uppercase tracking-wide text-secondary-500">
                {r.label}
              </dt>
              <dd className="break-words text-sm font-medium text-secondary-900">
                {r.value ?? <span className="italic text-secondary-400">Not provided</span>}
              </dd>
            </div>
          </div>
        ))}
      </dl>
      {provider.bio && (
        <div className="mt-3 rounded-lg bg-white p-3">
          <p className="text-[11px] font-bold uppercase tracking-wide text-secondary-500">
            Bio
          </p>
          <p className="mt-1 whitespace-pre-line text-sm text-secondary-800">
            {provider.bio}
          </p>
        </div>
      )}
    </div>
  );
}

function ProviderDocumentList({ provider }: { provider: Provider }) {
  const docs: Array<{ label: string; file: Provider["idDocument"] | undefined }> = [
    { label: "ID document", file: provider.idDocument },
    { label: "Business license", file: provider.businessLicense },
  ];
  const hasAnyDoc = docs.some((d) => d.file);
  return (
    <div>
      <h4 className="mb-2 text-xs font-bold uppercase tracking-wider text-secondary-500">
        Verification documents
      </h4>
      {!hasAnyDoc ? (
        <p className="rounded-lg border border-dashed border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
          No documents uploaded yet. Consider rejecting and asking the provider
          to re-submit with ID + (if applicable) business license.
        </p>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2">
          {docs.map((d) =>
            d.file ? (
              <a
                key={d.label}
                href={d.file.url}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex items-center gap-3 rounded-xl border-2 border-secondary-200 bg-white p-3 transition-colors hover:border-primary-400 hover:bg-primary-50"
              >
                <FileText className="h-7 w-7 shrink-0 text-primary-600" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-secondary-900">
                    {d.label}
                  </p>
                  <p className="truncate text-xs text-secondary-500">
                    {d.file.fileName || "Open file"}
                  </p>
                </div>
                <ExternalLink className="h-4 w-4 shrink-0 text-secondary-400 transition-colors group-hover:text-primary-600" />
              </a>
            ) : (
              <div
                key={d.label}
                className="flex items-center gap-3 rounded-xl border-2 border-dashed border-secondary-200 p-3 opacity-60"
              >
                <FileText className="h-7 w-7 shrink-0 text-secondary-400" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-secondary-700">
                    {d.label}
                  </p>
                  <p className="text-xs italic text-secondary-500">
                    Not uploaded
                  </p>
                </div>
              </div>
            ),
          )}
        </div>
      )}
    </div>
  );
}

function ProviderSpecialtiesBlock({ specialties }: { specialties: string[] }) {
  return (
    <div>
      <h4 className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-secondary-500">
        <Sparkles className="h-3.5 w-3.5" />
        Specialties
      </h4>
      <div className="flex flex-wrap gap-1.5">
        {specialties.map((s) => (
          <span
            key={s}
            className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-secondary-700 ring-1 ring-secondary-200"
          >
            {s}
          </span>
        ))}
      </div>
    </div>
  );
}

function ProviderGalleryBlock({
  gallery,
}: {
  gallery: NonNullable<Provider["gallery"]>;
}) {
  return (
    <div>
      <h4 className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-secondary-500">
        <ImageIcon className="h-3.5 w-3.5" />
        Gallery ({gallery.length})
      </h4>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {gallery.map((g) => (
          <a
            key={g.id}
            href={g.file.url}
            target="_blank"
            rel="noopener noreferrer"
            className="group relative aspect-square overflow-hidden rounded-lg bg-secondary-100"
          >
            <Image
              src={g.file.thumbnailUrl || g.file.url}
              alt={g.title || "Gallery item"}
              fill
              sizes="(max-width: 640px) 33vw, 20vw"
              className="object-cover transition-transform group-hover:scale-105"
            />
          </a>
        ))}
      </div>
    </div>
  );
}
