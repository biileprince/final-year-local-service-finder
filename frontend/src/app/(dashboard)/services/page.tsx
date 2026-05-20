"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  Briefcase,
  Plus,
  X,
  Save,
  CheckCircle2,
  AlertCircle,
  ImagePlus,
  Trash2,
  FileText,
  ShieldCheck,
  ArrowRight,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Badge } from "@/components/ui/badge";
import { useRequireRole } from "@/hooks";
import { providersService, categoriesService, filesService } from "@/lib/api";
import { useToast } from "@/components/ui/toast";
import type { Provider, Category } from "@/types";

export default function ProviderServicesPage() {
  const { isLoading: authLoading, hasRole } = useRequireRole(["PROVIDER"]);
  const [provider, setProvider] = useState<Provider | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<Set<string>>(
    new Set(),
  );
  const [specialties, setSpecialties] = useState<string[]>([]);
  const [newSpecialty, setNewSpecialty] = useState("");
  const [bio, setBio] = useState("");
  const [hourlyRate, setHourlyRate] = useState<string>("");
  const [yearsExperience, setYearsExperience] = useState<string>("");
  const [location, setLocation] = useState("");
  const [loading, setLoading] = useState(true);
  // Distinguish "no provider profile yet" (new user, needs onboarding) from a
  // real failure so we can route them to the right next step instead of
  // crashing on a NotFound exception.
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadingGallery, setUploadingGallery] = useState(false);
  const [uploadingDoc, setUploadingDoc] = useState<"id" | "license" | null>(
    null,
  );
  const { toast } = useToast();
  const [message, setMessage] = useState<{
    kind: "success" | "error";
    text: string;
  } | null>(null);

  useEffect(() => {
    if (!hasRole) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const cats = await categoriesService.getAll();
        if (cancelled) return;
        setCategories(cats);
        try {
          const me = await providersService.getMyProfile();
          if (cancelled) return;
          setProvider(me);
          setSelectedCategoryIds(
            new Set((me.categories || []).map((pc) => pc.category.id)),
          );
          setSpecialties((me.specialties || []).map((s) => s.specialty));
          setBio(me.bio || "");
          setHourlyRate(String(me.hourlyRate ?? ""));
          setYearsExperience(String(me.yearsExperience ?? ""));
          setLocation(me.location || "");
        } catch (err) {
          // 404 / "not found" means the provider row was never created during
          // onboarding — route them through that flow instead of error-pageing.
          const msg = err instanceof Error ? err.message.toLowerCase() : "";
          if (msg.includes("not found") || msg.includes("404")) {
            setNeedsOnboarding(true);
          } else {
            throw err;
          }
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [hasRole]);

  if (!authLoading && hasRole && needsOnboarding) {
    return <ProviderProfileMissingCard />;
  }

  const toggleCategory = (id: string) => {
    setSelectedCategoryIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const addSpecialty = () => {
    const s = newSpecialty.trim();
    if (!s) return;
    if (specialties.includes(s)) return;
    setSpecialties((prev) => [...prev, s]);
    setNewSpecialty("");
  };

  const removeSpecialty = (s: string) =>
    setSpecialties((prev) => prev.filter((x) => x !== s));

  const handleGalleryUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length || !provider) return;

    setUploadingGallery(true);
    try {
      const uploaded = await Promise.all(
        Array.from(files).map((f) => filesService.upload(f, "GALLERY")),
      );
      const fileIds = uploaded.map((u) => u.id);
      await providersService.addGalleryItems(provider.id, fileIds);
      const updated = await providersService.getMyProfile();
      setProvider(updated);
      toast({ variant: "success", title: "Gallery updated" });
    } catch (err) {
      toast({
        variant: "error",
        title: "Upload failed",
        description: err instanceof Error ? err.message : "Try again.",
      });
    } finally {
      setUploadingGallery(false);
      e.target.value = "";
    }
  };

  const handleVerificationDocUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    kind: "id" | "license",
  ) => {
    const file = e.target.files?.[0];
    if (!file || !provider) return;
    setUploadingDoc(kind);
    try {
      const uploaded = await filesService.upload(file, "VERIFICATION");
      const docs =
        kind === "id"
          ? { idDocumentId: uploaded.id }
          : { businessLicenseId: uploaded.id };
      await providersService.setVerificationDocuments(provider.id, docs);
      const updated = await providersService.getMyProfile();
      setProvider(updated);
      toast({
        variant: "success",
        title: kind === "id" ? "ID uploaded" : "License uploaded",
        description: "Admins can now review your verification.",
      });
    } catch (err) {
      toast({
        variant: "error",
        title: "Upload failed",
        description: err instanceof Error ? err.message : "Try again.",
      });
    } finally {
      setUploadingDoc(null);
      e.target.value = "";
    }
  };

  const handleVerificationDocRemove = async (kind: "id" | "license") => {
    if (!provider) return;
    setUploadingDoc(kind);
    try {
      const docs =
        kind === "id"
          ? { idDocumentId: null }
          : { businessLicenseId: null };
      await providersService.setVerificationDocuments(provider.id, docs);
      const updated = await providersService.getMyProfile();
      setProvider(updated);
      toast({ variant: "success", title: "Document removed" });
    } catch (err) {
      toast({
        variant: "error",
        title: "Remove failed",
        description: err instanceof Error ? err.message : "Try again.",
      });
    } finally {
      setUploadingDoc(null);
    }
  };

  const handleGalleryRemove = async (itemId: string) => {
    if (!provider) return;
    try {
      await providersService.removeGalleryItem(provider.id, itemId);
      const updated = await providersService.getMyProfile();
      setProvider(updated);
    } catch (err) {
      toast({
        variant: "error",
        title: "Couldn't remove image",
        description: err instanceof Error ? err.message : "Try again.",
      });
    }
  };

  const handleSave = async () => {
    if (!provider) return;
    setMessage(null);

    const rateNum = Number(hourlyRate);
    const yearsNum = Number(yearsExperience);
    if (Number.isNaN(rateNum) || rateNum < 0) {
      setMessage({ kind: "error", text: "Please enter a valid hourly rate." });
      return;
    }
    if (Number.isNaN(yearsNum) || yearsNum < 0) {
      setMessage({
        kind: "error",
        text: "Please enter valid years of experience.",
      });
      return;
    }
    if (selectedCategoryIds.size === 0) {
      setMessage({
        kind: "error",
        text: "Choose at least one service category.",
      });
      return;
    }

    setSaving(true);
    try {
      await providersService.updateProfile({
        bio: bio.trim(),
        hourlyRate: rateNum,
        yearsExperience: yearsNum,
        location: location.trim(),
      });
      await providersService.setCategories(Array.from(selectedCategoryIds));
      await providersService.setSpecialties(specialties);
      const updated = await providersService.getMyProfile();
      setProvider(updated);
      setMessage({ kind: "success", text: "Services saved successfully." });
    } catch (err) {
      setMessage({
        kind: "error",
        text: err instanceof Error ? err.message : "Failed to save changes.",
      });
    } finally {
      setSaving(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!hasRole || !provider) return null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-secondary-900">My Services</h1>
        <p className="mt-1 text-secondary-600">
          Update what you offer, your rate, and how customers find you.
        </p>
      </div>

      {message && (
        <div
          className={`flex items-center gap-2 rounded-xl border-2 px-4 py-3 text-sm ${
            message.kind === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-red-200 bg-red-50 text-red-800"
          }`}
        >
          {message.kind === "success" ? (
            <CheckCircle2 className="h-4 w-4" />
          ) : (
            <AlertCircle className="h-4 w-4" />
          )}
          {message.text}
        </div>
      )}

      {/* Service profile */}
      <Card>
        <CardHeader>
          <CardTitle>Service profile</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-secondary-700">
              Bio
            </label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              rows={4}
              placeholder="Describe your services, experience, and what makes you stand out…"
              className="w-full rounded-xl border-2 border-gray-200 px-4 py-3 text-sm text-secondary-900 placeholder:text-secondary-400 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-secondary-700">
                Hourly rate (GHS)
              </label>
              <input
                type="number"
                min={0}
                value={hourlyRate}
                onChange={(e) => setHourlyRate(e.target.value)}
                className="w-full rounded-xl border-2 border-gray-200 px-4 py-2.5 text-sm text-secondary-900 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-secondary-700">
                Years of experience
              </label>
              <input
                type="number"
                min={0}
                value={yearsExperience}
                onChange={(e) => setYearsExperience(e.target.value)}
                className="w-full rounded-xl border-2 border-gray-200 px-4 py-2.5 text-sm text-secondary-900 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-secondary-700">
                Location
              </label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g. Accra, East Legon"
                className="w-full rounded-xl border-2 border-gray-200 px-4 py-2.5 text-sm text-secondary-900 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Categories */}
      <Card>
        <CardHeader>
          <CardTitle>Service categories</CardTitle>
        </CardHeader>
        <CardContent>
          {categories.length === 0 ? (
            <p className="text-sm text-secondary-500">
              No categories available.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {categories.map((cat) => {
                const active = selectedCategoryIds.has(cat.id);
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => toggleCategory(cat.id)}
                    className={`inline-flex items-center gap-1.5 rounded-full border-2 px-3 py-1.5 text-sm font-semibold transition-colors ${
                      active
                        ? "border-primary-500 bg-primary-50 text-primary-700"
                        : "border-secondary-200 bg-white text-secondary-700 hover:border-primary-300"
                    }`}
                  >
                    <Briefcase className="h-3.5 w-3.5" />
                    {cat.name}
                  </button>
                );
              })}
            </div>
          )}
          <p className="mt-3 text-xs text-secondary-500">
            {selectedCategoryIds.size} selected
          </p>
        </CardContent>
      </Card>

      {/* Specialties */}
      <Card>
        <CardHeader>
          <CardTitle>Specialties</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <input
              value={newSpecialty}
              onChange={(e) => setNewSpecialty(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addSpecialty();
                }
              }}
              placeholder="e.g. Pipe leak repair"
              className="flex-1 rounded-xl border-2 border-gray-200 px-4 py-2.5 text-sm text-secondary-900 placeholder:text-secondary-400 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
            />
            <Button type="button" variant="outline" onClick={addSpecialty}>
              <Plus className="mr-1 h-4 w-4" />
              Add
            </Button>
          </div>
          {specialties.length === 0 ? (
            <p className="text-sm text-secondary-500">
              No specialties yet — add the specific services you offer.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {specialties.map((s) => (
                <Badge
                  key={s}
                  variant="secondary"
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm"
                >
                  {s}
                  <button
                    type="button"
                    onClick={() => removeSpecialty(s)}
                    className="rounded-full p-0.5 hover:bg-secondary-200"
                    aria-label={`Remove ${s}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Verification documents */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary-600" />
            Verification documents
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-secondary-600">
            Upload a government-issued ID and (optionally) a business license.
            Admins use these to verify your account before it shows up in search.
          </p>

          <div className="grid gap-3 sm:grid-cols-2">
            {(["id", "license"] as const).map((kind) => {
              const file =
                kind === "id" ? provider.idDocument : provider.businessLicense;
              const label = kind === "id" ? "ID document" : "Business license";
              const isImg =
                file?.mimeType?.startsWith("image/") ||
                (file?.url && /\.(png|jpe?g|gif|webp)$/i.test(file.url));
              return (
                <div
                  key={kind}
                  className="rounded-xl border border-secondary-200 bg-white p-4"
                >
                  <p className="text-sm font-semibold text-secondary-900">
                    {label}
                  </p>
                  {file ? (
                    <div className="mt-2 space-y-2">
                      {isImg ? (
                        <Image
                          src={file.url}
                          alt={label}
                          width={320}
                          height={160}
                          sizes="(max-width: 768px) 100vw, 320px"
                          className="max-h-40 w-auto rounded-lg object-cover"
                        />
                      ) : (
                        <a
                          href={file.url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-2 text-sm text-primary-700 underline"
                        >
                          <FileText className="h-4 w-4" />
                          {file.fileName || "Open file"}
                        </a>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleVerificationDocRemove(kind)}
                        disabled={uploadingDoc === kind}
                      >
                        Remove
                      </Button>
                    </div>
                  ) : (
                    <label className="mt-2 inline-flex cursor-pointer items-center gap-2 rounded-lg border-2 border-dashed border-gray-300 px-3 py-2 text-sm font-semibold text-secondary-700 hover:border-primary-400 hover:bg-primary-50">
                      <ImagePlus className="h-4 w-4" />
                      {uploadingDoc === kind ? "Uploading…" : "Upload"}
                      <input
                        type="file"
                        accept="image/*,application/pdf"
                        onChange={(e) => handleVerificationDocUpload(e, kind)}
                        disabled={uploadingDoc === kind}
                        className="hidden"
                      />
                    </label>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Gallery */}
      <Card>
        <CardHeader>
          <CardTitle>Portfolio gallery</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-secondary-600">
            Show off past work — these images appear on your public profile.
          </p>

          <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border-2 border-dashed border-gray-300 px-4 py-3 text-sm font-semibold text-secondary-700 hover:border-primary-400 hover:bg-primary-50">
            <ImagePlus className="h-4 w-4" />
            {uploadingGallery ? "Uploading…" : "Upload images"}
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={handleGalleryUpload}
              disabled={uploadingGallery}
              className="hidden"
            />
          </label>

          {(provider.gallery?.length ?? 0) === 0 ? (
            <p className="text-sm text-secondary-500">No images yet.</p>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
              {provider.gallery?.map((item) => (
                <div
                  key={item.id}
                  className="group relative aspect-square overflow-hidden rounded-xl border border-gray-200"
                >
                  <Image
                    src={item.file.thumbnailUrl || item.file.url}
                    alt={item.title || "Gallery image"}
                    fill
                    sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, 25vw"
                    className="object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => handleGalleryRemove(item.id)}
                    className="absolute right-2 top-2 rounded-full bg-white/90 p-1.5 text-error-600 opacity-0 shadow transition-opacity group-hover:opacity-100 hover:bg-white"
                    aria-label="Remove image"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} isLoading={saving}>
          <Save className="mr-2 h-4 w-4" />
          Save changes
        </Button>
      </div>
    </div>
  );
}

// Reusable empty state shown when a provider visits provider-only pages
// before completing onboarding.
function ProviderProfileMissingCard() {
  return (
    <Card>
      <CardContent className="py-16 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-100">
          <Briefcase className="h-7 w-7 text-primary-600" />
        </div>
        <h2 className="mt-5 text-xl font-bold text-secondary-900">
          Set up your provider profile first
        </h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-secondary-600">
          You haven&apos;t finished provider onboarding yet. Add your service
          bio, location, and verification documents — then you can start
          managing services here.
        </p>
        <Button asChild className="mt-6">
          <Link href="/onboarding">
            Continue onboarding
            <ArrowRight className="ml-1 h-4 w-4" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
