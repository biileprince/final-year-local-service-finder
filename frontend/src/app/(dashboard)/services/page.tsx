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
  Clock,
  DollarSign,
  Edit2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Badge } from "@/components/ui/badge";
import { useRequireRole } from "@/hooks";
import { providersService, categoriesService, filesService } from "@/lib/api";
import { useToast } from "@/components/ui/toast";
import {
  LocationPicker,
  type PickedLocation,
} from "@/components/onboarding/location-picker";
import { CategoryDropdown } from "@/components/onboarding/category-dropdown";
import type { Provider, Category, ProviderHours, ProviderService } from "@/types";

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

function minutesToTime(mins: number): string {
  return `${String(Math.floor(mins / 60)).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}`;
}

function timeToMinutes(t: string): number {
  const [h = "0", m = "0"] = t.split(":");
  return parseInt(h) * 60 + parseInt(m);
}

function formatCurrencyGHS(n: number): string {
  return `GH₵ ${Number(n).toFixed(2)}`;
}

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
  const [cancellationPolicy, setCancellationPolicy] = useState("");
  const [location, setLocation] = useState("");
  // Coords captured by the Mapbox-backed picker. We track whether the user has
  // actively re-picked their location in this session so we only ship new
  // lat/lng to the server when the label was changed — typing a different city
  // without picking from the dropdown shouldn't keep the old (now stale) pin.
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(
    null,
  );
  const [locationTouched, setLocationTouched] = useState(false);
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

  // Business hours
  const [hours, setHours] = useState<ProviderHours[]>([]);
  const [savingHours, setSavingHours] = useState(false);

  // Service offerings
  const [services, setServices] = useState<ProviderService[]>([]);
  const [savingService, setSavingService] = useState(false);
  const [editingService, setEditingService] = useState<ProviderService | null>(null);
  const [showServiceForm, setShowServiceForm] = useState(false);
  const [serviceForm, setServiceForm] = useState({
    name: "",
    basePrice: "",
    durationMin: "60",
    description: "",
    categoryId: "",
    isActive: true,
  });

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
          const [me, myHours, myServices] = await Promise.all([
            providersService.getMyProfile(),
            providersService.getMyHours().catch(() => [] as ProviderHours[]),
            providersService.getMyServices().catch(() => [] as ProviderService[]),
          ]);
          if (cancelled) return;
          setHours(myHours);
          setServices(myServices);
          setProvider(me);
          setSelectedCategoryIds(
            new Set((me.categories || []).map((pc) => pc.category.id)),
          );
          setSpecialties((me.specialties || []).map((s) => s.specialty));
          setBio(me.bio || "");
          setHourlyRate(String(me.hourlyRate ?? ""));
          setYearsExperience(String(me.yearsExperience ?? ""));
          setCancellationPolicy(me.cancellationPolicy || "");
          setLocation(me.location || "");
          if (
            typeof me.latitude === "number" &&
            typeof me.longitude === "number"
          ) {
            setCoords({ lat: me.latitude, lng: me.longitude });
          }
          setLocationTouched(false);
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

  const handleSaveHours = async () => {
    setSavingHours(true);
    try {
      const saved = await providersService.upsertMyHours(
        hours.map(({ dayOfWeek, openMinutes, closeMinutes, isClosed }) => ({
          dayOfWeek,
          openMinutes,
          closeMinutes,
          isClosed,
        })),
      );
      setHours(saved);
      toast({ variant: "success", title: "Business hours saved" });
    } catch (err) {
      toast({
        variant: "error",
        title: "Couldn't save hours",
        description: err instanceof Error ? err.message : "Try again.",
      });
    } finally {
      setSavingHours(false);
    }
  };

  const handleOpenServiceForm = (svc?: ProviderService) => {
    if (svc) {
      setEditingService(svc);
      setServiceForm({
        name: svc.name,
        basePrice: String(svc.basePrice),
        durationMin: String(svc.durationMin),
        description: svc.description ?? "",
        categoryId: svc.categoryId ?? "",
        isActive: svc.isActive,
      });
    } else {
      setEditingService(null);
      setServiceForm({ name: "", basePrice: "", durationMin: "60", description: "", categoryId: "", isActive: true });
    }
    setShowServiceForm(true);
  };

  const handleSaveService = async () => {
    const price = Number(serviceForm.basePrice);
    if (!serviceForm.name.trim()) {
      toast({ variant: "error", title: "Service name is required" });
      return;
    }
    if (Number.isNaN(price) || price < 0) {
      toast({ variant: "error", title: "Enter a valid price" });
      return;
    }
    setSavingService(true);
    try {
      if (editingService) {
        const updated = await providersService.updateService(editingService.id, {
          name: serviceForm.name.trim(),
          basePrice: price,
          durationMin: Number(serviceForm.durationMin) || 60,
          description: serviceForm.description.trim() || undefined,
          categoryId: serviceForm.categoryId || undefined,
          isActive: serviceForm.isActive,
        });
        setServices((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
        toast({ variant: "success", title: "Service updated" });
      } else {
        const created = await providersService.createService({
          name: serviceForm.name.trim(),
          basePrice: price,
          durationMin: Number(serviceForm.durationMin) || 60,
          description: serviceForm.description.trim() || undefined,
          categoryId: serviceForm.categoryId || undefined,
          isActive: serviceForm.isActive,
        });
        setServices((prev) => [...prev, created]);
        toast({ variant: "success", title: "Service added" });
      }
      setShowServiceForm(false);
      setEditingService(null);
    } catch (err) {
      toast({
        variant: "error",
        title: "Couldn't save service",
        description: err instanceof Error ? err.message : "Try again.",
      });
    } finally {
      setSavingService(false);
    }
  };

  const handleDeleteService = async (id: string) => {
    try {
      await providersService.deleteService(id);
      setServices((prev) => prev.filter((s) => s.id !== id));
      toast({ variant: "success", title: "Service removed" });
    } catch (err) {
      toast({
        variant: "error",
        title: "Couldn't remove service",
        description: err instanceof Error ? err.message : "Try again.",
      });
    }
  };

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
        cancellationPolicy: cancellationPolicy.trim(),
        location: location.trim(),
        // Only ship coords when the user picked a new location this session —
        // avoids accidentally re-sending stale lat/lng if they only edited the
        // text by hand, in which case the server should keep what it has.
        ...(locationTouched && coords
          ? { latitude: coords.lat, longitude: coords.lng }
          : {}),
      });
      await providersService.setCategories(Array.from(selectedCategoryIds));
      await providersService.setSpecialties(specialties);
      const updated = await providersService.getMyProfile();
      setProvider(updated);
      if (
        typeof updated.latitude === "number" &&
        typeof updated.longitude === "number"
      ) {
        setCoords({ lat: updated.latitude, lng: updated.longitude });
      }
      setLocationTouched(false);
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
      <Card id="section-profile" className="scroll-mt-24">
        <CardHeader>
          <CardTitle>Service profile</CardTitle>
          <p className="mt-1 text-sm text-secondary-600">
            Your bio, service area, and rate — this is what customers see first.
          </p>
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
              className="w-full rounded-xl border-2 border-gray-200 px-4 py-3 text-sm text-secondary-900 placeholder:text-secondary-500 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
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
              <LocationPicker
                value={location}
                onSelect={(loc: PickedLocation) => {
                  setLocation(loc.label);
                  setCoords({ lat: loc.lat, lng: loc.lng });
                  setLocationTouched(true);
                }}
                onClear={() => {
                  setLocation("");
                  setCoords(null);
                  setLocationTouched(true);
                }}
                placeholder="Search any town in Ghana — e.g. Accra, Tarkwa…"
              />
              {coords && !locationTouched && (
                <p className="mt-1 text-xs text-secondary-500">
                  Pinned on the map (lat {coords.lat.toFixed(4)}, lng{" "}
                  {coords.lng.toFixed(4)}). Pick a new location to update.
                </p>
              )}
              {locationTouched && coords && (
                <p className="mt-1 text-xs text-success-700">
                  New pin captured — save to update your map location.
                </p>
              )}
              {locationTouched && !coords && (
                <p className="mt-1 text-xs text-amber-700 dark:text-amber-200">
                  Pick a location from the suggestions to set a new map pin —
                  saving without a pick leaves the existing pin unchanged.
                </p>
              )}
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-secondary-700">
              Cancellation policy
            </label>
            <textarea
              value={cancellationPolicy}
              onChange={(e) => setCancellationPolicy(e.target.value)}
              rows={3}
              maxLength={1000}
              placeholder="e.g. Free cancellation up to 24h before the appointment. Same-day cancellations may incur a call-out fee, payable directly to me."
              className="w-full rounded-xl border-2 border-gray-200 px-4 py-3 text-sm text-secondary-900 placeholder:text-secondary-500 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
            />
            <p className="mt-1 text-xs text-secondary-500">
              Shown to customers before they book. Payments are handled offline,
              so any fee is collected directly by you.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Categories */}
      <Card id="section-categories" className="scroll-mt-24">
        <CardHeader>
          <CardTitle>Service categories</CardTitle>
          <p className="mt-1 text-sm text-secondary-600">
            Choose the categories you offer. These are how customers find you.
          </p>
        </CardHeader>
        <CardContent>
          <CategoryDropdown
            categories={categories}
            selectedIds={Array.from(selectedCategoryIds)}
            onToggle={toggleCategory}
            maxSelectable={3}
            loading={categories.length === 0 && loading}
          />
        </CardContent>
      </Card>

      {/* Specialties */}
      <Card id="section-specialties" className="scroll-mt-24">
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
              className="flex-1 rounded-xl border-2 border-gray-200 px-4 py-2.5 text-sm text-secondary-900 placeholder:text-secondary-500 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
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
      <Card id="section-verification" className="scroll-mt-24">
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
      <Card id="section-gallery" className="scroll-mt-24">
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

      {/* Business hours */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary-600" />
            Business hours
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            {DAY_NAMES.map((day, idx) => {
              const entry = hours.find((h) => h.dayOfWeek === idx);
              const isClosed = entry ? entry.isClosed : true;
              const openVal = entry && !entry.isClosed ? minutesToTime(entry.openMinutes) : "09:00";
              const closeVal = entry && !entry.isClosed ? minutesToTime(entry.closeMinutes) : "17:00";
              return (
                <div
                  key={day}
                  className="flex items-center gap-3 rounded-xl border border-secondary-100 bg-white px-4 py-2.5"
                >
                  <span className="w-10 shrink-0 text-sm font-semibold text-secondary-700">
                    {day}
                  </span>
                  <label className="flex cursor-pointer items-center gap-2 text-sm text-secondary-600">
                    <input
                      type="checkbox"
                      checked={!isClosed}
                      onChange={(e) => {
                        const open = e.target.checked;
                        setHours((prev) => {
                          const existing = prev.find((h) => h.dayOfWeek === idx);
                          if (existing) {
                            return prev.map((h) =>
                              h.dayOfWeek === idx ? { ...h, isClosed: !open } : h,
                            );
                          }
                          return [
                            ...prev,
                            {
                              id: "",
                              providerId: provider.id,
                              dayOfWeek: idx,
                              openMinutes: 540,
                              closeMinutes: 1020,
                              isClosed: !open,
                            },
                          ];
                        });
                      }}
                      className="h-4 w-4 rounded border-secondary-300 accent-primary-600"
                    />
                    Open
                  </label>
                  {!isClosed ? (
                    <div className="flex flex-1 items-center gap-2">
                      <input
                        type="time"
                        value={openVal}
                        onChange={(e) => {
                          const mins = timeToMinutes(e.target.value);
                          setHours((prev) => {
                            const existing = prev.find((h) => h.dayOfWeek === idx);
                            if (existing) {
                              return prev.map((h) =>
                                h.dayOfWeek === idx ? { ...h, openMinutes: mins } : h,
                              );
                            }
                            return [
                              ...prev,
                              { id: "", providerId: provider.id, dayOfWeek: idx, openMinutes: mins, closeMinutes: 1020, isClosed: false },
                            ];
                          });
                        }}
                        className="rounded-lg border border-secondary-200 px-2 py-1.5 text-sm focus:border-primary-500 focus:outline-none"
                      />
                      <span className="text-secondary-400">–</span>
                      <input
                        type="time"
                        value={closeVal}
                        onChange={(e) => {
                          const mins = timeToMinutes(e.target.value);
                          setHours((prev) => {
                            const existing = prev.find((h) => h.dayOfWeek === idx);
                            if (existing) {
                              return prev.map((h) =>
                                h.dayOfWeek === idx ? { ...h, closeMinutes: mins } : h,
                              );
                            }
                            return [
                              ...prev,
                              { id: "", providerId: provider.id, dayOfWeek: idx, openMinutes: 540, closeMinutes: mins, isClosed: false },
                            ];
                          });
                        }}
                        className="rounded-lg border border-secondary-200 px-2 py-1.5 text-sm focus:border-primary-500 focus:outline-none"
                      />
                    </div>
                  ) : (
                    <span className="ml-2 text-sm italic text-secondary-400">Closed</span>
                  )}
                </div>
              );
            })}
          </div>
          <div className="flex justify-end">
            <Button type="button" variant="outline" onClick={handleSaveHours} isLoading={savingHours}>
              <Save className="mr-2 h-4 w-4" />
              Save hours
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Service offerings */}
      <Card id="section-services" className="scroll-mt-24">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-primary-600" />
            Service offerings
          </CardTitle>
          {!showServiceForm && (
            <Button type="button" size="sm" onClick={() => handleOpenServiceForm()}>
              <Plus className="mr-1 h-4 w-4" />
              Add service
            </Button>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          {showServiceForm && (
            <div className="space-y-3 rounded-xl border-2 border-primary-200 bg-primary-50 p-4">
              <h3 className="text-sm font-semibold text-secondary-900">
                {editingService ? "Edit service" : "New service"}
              </h3>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-secondary-700">
                    Service name *
                  </label>
                  <input
                    value={serviceForm.name}
                    onChange={(e) => setServiceForm((p) => ({ ...p, name: e.target.value }))}
                    placeholder="e.g. Pipe leak repair"
                    className="w-full rounded-xl border-2 border-gray-200 px-3 py-2 text-sm text-secondary-900 placeholder:text-secondary-500 focus:border-primary-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-secondary-700">
                    Base price (GHS) *
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={serviceForm.basePrice}
                    onChange={(e) => setServiceForm((p) => ({ ...p, basePrice: e.target.value }))}
                    placeholder="0.00"
                    className="w-full rounded-xl border-2 border-gray-200 px-3 py-2 text-sm text-secondary-900 placeholder:text-secondary-500 focus:border-primary-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-secondary-700">
                    Duration (minutes)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={serviceForm.durationMin}
                    onChange={(e) => setServiceForm((p) => ({ ...p, durationMin: e.target.value }))}
                    className="w-full rounded-xl border-2 border-gray-200 px-3 py-2 text-sm text-secondary-900 focus:border-primary-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-secondary-700">
                    Category
                  </label>
                  <select
                    value={serviceForm.categoryId}
                    onChange={(e) => setServiceForm((p) => ({ ...p, categoryId: e.target.value }))}
                    className="w-full rounded-xl border-2 border-gray-200 px-3 py-2 text-sm text-secondary-900 focus:border-primary-500 focus:outline-none"
                  >
                    <option value="">— none —</option>
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-secondary-700">
                  Description
                </label>
                <textarea
                  value={serviceForm.description}
                  onChange={(e) => setServiceForm((p) => ({ ...p, description: e.target.value }))}
                  rows={2}
                  placeholder="Brief description of what's included…"
                  className="w-full rounded-xl border-2 border-gray-200 px-3 py-2 text-sm text-secondary-900 placeholder:text-secondary-500 focus:border-primary-500 focus:outline-none"
                />
              </div>
              <label className="flex cursor-pointer items-center gap-2 text-sm text-secondary-700">
                <input
                  type="checkbox"
                  checked={serviceForm.isActive}
                  onChange={(e) => setServiceForm((p) => ({ ...p, isActive: e.target.checked }))}
                  className="h-4 w-4 rounded accent-primary-600"
                />
                Active (visible to customers)
              </label>
              <div className="flex justify-end gap-2 pt-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => { setShowServiceForm(false); setEditingService(null); }}
                >
                  Cancel
                </Button>
                <Button type="button" size="sm" onClick={handleSaveService} isLoading={savingService}>
                  {editingService ? "Save changes" : "Add service"}
                </Button>
              </div>
            </div>
          )}

          {services.length === 0 && !showServiceForm ? (
            <p className="text-sm text-secondary-500">
              No services yet — add your first service offering above.
            </p>
          ) : (
            <div className="space-y-2">
              {services.map((svc) => (
                <div
                  key={svc.id}
                  className={`flex items-start justify-between rounded-xl border px-4 py-3 ${
                    svc.isActive
                      ? "border-secondary-200 bg-white"
                      : "border-dashed border-secondary-200 bg-gray-50 opacity-70"
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-secondary-900">{svc.name}</span>
                      {!svc.isActive && (
                        <Badge variant="secondary" className="text-xs">Inactive</Badge>
                      )}
                    </div>
                    <div className="mt-0.5 flex items-center gap-3 text-sm text-secondary-600">
                      <span>{formatCurrencyGHS(svc.basePrice)}</span>
                      {svc.durationMin > 0 && (
                        <span className="flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5" />
                          {svc.durationMin} min
                        </span>
                      )}
                      {svc.category && (
                        <span className="text-secondary-500">· {svc.category.name}</span>
                      )}
                    </div>
                    {svc.description && (
                      <p className="mt-1 truncate text-xs text-secondary-500">
                        {svc.description}
                      </p>
                    )}
                  </div>
                  <div className="ml-3 flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => handleOpenServiceForm(svc)}
                      className="rounded-lg p-1.5 text-secondary-500 hover:bg-secondary-100 hover:text-secondary-700"
                      aria-label="Edit service"
                    >
                      <Edit2 className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteService(svc.id)}
                      className="rounded-lg p-1.5 text-error-500 hover:bg-error-50 hover:text-error-700"
                      aria-label="Delete service"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
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
