"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  CheckCircle,
  Clock,
  FileText,
  ArrowRight,
  Tag,
  ShieldCheck,
  Upload,
  X,
  Image as ImageIcon,
  Camera,
  Navigation,
  Phone,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { Avatar } from "@/components/ui/avatar";
import {
  LocationPicker,
  type PickedLocation,
} from "@/components/onboarding/location-picker";
import { useAuth } from "@/hooks";
import {
  providersService,
  categoriesService,
  filesService,
  authService,
} from "@/lib/api";
import type { Category, Provider } from "@/types";
import { cn } from "@/lib/utils";

const profileSchema = z.object({
  bio: z
    .string()
    .min(30, "Please write at least 30 characters about your services")
    .max(500, "Keep it under 500 characters"),
  location: z.string().min(2, "Pick the area you operate from"),
  yearsExperience: z.coerce
    .number()
    .min(0, "Must be 0 or more")
    .max(60, "Please enter a valid number"),
  // Optional but high-value fields collected during onboarding.
  phone: z.string().trim().max(20).optional().or(z.literal("")),
  serviceRadiusKm: z.coerce
    .number()
    .min(1, "Must be at least 1 km")
    .max(200, "Cap is 200 km")
    .default(25),
});

type ProfileFormData = z.infer<typeof profileSchema>;

const STEPS = [
  "Your profile",
  "Service categories",
  "Verification",
  "You're ready",
] as const;

interface UploadedDoc {
  id: string;
  url: string;
  fileName: string;
  mimeType: string;
}

export default function OnboardingPage() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading, setUser } = useAuth();

  const [provider, setProvider] = useState<Provider | null>(null);
  const [step, setStep] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);
  const [catLoading, setCatLoading] = useState(true);

  // Profile photo (step 0)
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  // Verification document state
  const [idDoc, setIdDoc] = useState<UploadedDoc | null>(null);
  const [licenseDoc, setLicenseDoc] = useState<UploadedDoc | null>(null);
  const [uploadingKind, setUploadingKind] = useState<"id" | "license" | null>(
    null,
  );
  const idInputRef = useRef<HTMLInputElement>(null);
  const licenseInputRef = useRef<HTMLInputElement>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
  } = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      bio: "",
      location: "",
      yearsExperience: 1,
      phone: user?.phone ?? "",
      serviceRadiusKm: 25,
    },
  });

  const watchedLocation = watch("location");

  // Geo coords captured by "Use my location" — submitted alongside the form
  // so customers see the provider pinned on the map immediately.
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(
    null,
  );
  const [geoStatus, setGeoStatus] = useState<
    "idle" | "locating" | "ready" | "denied" | "unavailable" | "timeout"
  >("idle");

  const detectLocation = async () => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setGeoStatus("unavailable");
      return;
    }
    if (typeof window !== "undefined" && !window.isSecureContext) {
      setGeoStatus("unavailable");
      return;
    }
    setGeoStatus("locating");
    setSaveError(null);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setCoords({ lat, lng });
        setGeoStatus("ready");
        // Reverse geocode via Nominatim (public, attribution-only). Pull the
        // suburb / town / city / region so we can pre-fill the location field
        // with something that matches what customers actually search for.
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&zoom=14&accept-language=en`,
            { headers: { Accept: "application/json" } },
          );
          if (!res.ok) return;
          const data = await res.json();
          const a = data.address || {};
          const place =
            a.suburb ||
            a.neighbourhood ||
            a.village ||
            a.town ||
            a.city ||
            a.county ||
            null;
          const region = a.state || a.region || null;
          if (place) {
            setValue("location", region ? `${place}, ${region}` : place, {
              shouldValidate: true,
            });
          }
        } catch {
          // Reverse-geocode is best-effort — the manual picker still works.
        }
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) setGeoStatus("denied");
        else if (err.code === err.TIMEOUT) setGeoStatus("timeout");
        else setGeoStatus("unavailable");
      },
      { enableHighAccuracy: false, timeout: 15000, maximumAge: 5 * 60 * 1000 },
    );
  };

  // Redirect non-providers or unauthenticated users. The `user` guard is
  // important: during a fresh register → onboarding transition the store's
  // isAuthenticated can flip true before `user` is populated on the next
  // render, and `undefined !== "PROVIDER"` would otherwise bounce providers
  // straight to the dashboard.
  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated) {
      router.replace("/login");
      return;
    }
    if (user && user.role !== "PROVIDER") {
      router.replace("/dashboard");
    }
  }, [isLoading, isAuthenticated, user, router]);

  // Load existing provider profile (for pre-filling docs on revisit) + categories.
  useEffect(() => {
    if (!isAuthenticated || (user && user.role !== "PROVIDER")) return;
    let cancelled = false;
    (async () => {
      try {
        const [me, cats] = await Promise.all([
          providersService.getMyProfile().catch(() => null),
          categoriesService.getAll(),
        ]);
        if (cancelled) return;
        if (me) {
          setProvider(me);
          if (me.idDocument) {
            setIdDoc({
              id: me.idDocument.id,
              url: me.idDocument.url,
              fileName: me.idDocument.fileName || "ID document",
              mimeType: me.idDocument.mimeType || "",
            });
          }
          if (me.businessLicense) {
            setLicenseDoc({
              id: me.businessLicense.id,
              url: me.businessLicense.url,
              fileName: me.businessLicense.fileName || "Business license",
              mimeType: me.businessLicense.mimeType || "",
            });
          }
        }
        setCategories(cats);
      } catch {
        setCategories([]);
      } finally {
        if (!cancelled) setCatLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, user]);

  const toggleCategory = (id: string) => {
    setSelectedCategoryIds((prev) =>
      prev.includes(id)
        ? prev.filter((c) => c !== id)
        : prev.length < 3
          ? [...prev, id]
          : prev,
    );
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingAvatar(true);
    setSaveError(null);
    try {
      const uploaded = await filesService.upload(file, "AVATAR");
      const updated = await authService.updateUser({
        profileImage: uploaded.url,
      });
      setUser(updated);
    } catch (err) {
      setSaveError(
        err instanceof Error ? err.message : "Couldn't upload profile photo.",
      );
    } finally {
      setUploadingAvatar(false);
      if (avatarInputRef.current) avatarInputRef.current.value = "";
    }
  };

  const onSubmitProfile = async (data: ProfileFormData) => {
    setIsSaving(true);
    setSaveError(null);
    try {
      // Phone goes on the User row, not Provider. Update it first if changed.
      if (data.phone && data.phone !== user?.phone) {
        try {
          const updatedUser = await authService.updateUser({
            phone: data.phone,
          });
          setUser(updatedUser);
        } catch {
          // Non-blocking — keep going with provider profile.
        }
      }
      const updated = await providersService.updateProfile({
        bio: data.bio,
        location: data.location,
        yearsExperience: data.yearsExperience,
        serviceRadiusKm: data.serviceRadiusKm,
        // Pin the map marker if we captured GPS. Bookings on this provider
        // will surface the route + ETA on the customer-facing detail page.
        ...(coords && { latitude: coords.lat, longitude: coords.lng }),
      });
      setProvider(updated);
      setStep(1);
    } catch (err) {
      setSaveError(
        err instanceof Error ? err.message : "Failed to save profile",
      );
    } finally {
      setIsSaving(false);
    }
  };

  const onSubmitCategories = async () => {
    setIsSaving(true);
    setSaveError(null);
    try {
      if (selectedCategoryIds.length > 0) {
        await providersService.setCategories(selectedCategoryIds);
      }
      setStep(2);
    } catch {
      // Categories endpoint may not exist yet — proceed anyway
      setStep(2);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDocUpload = async (
    file: File,
    kind: "id" | "license",
  ): Promise<void> => {
    if (!provider) {
      setSaveError("Profile is still loading — please retry in a moment.");
      return;
    }
    setUploadingKind(kind);
    setSaveError(null);
    try {
      const uploaded = await filesService.upload(file, "VERIFICATION");
      const docs =
        kind === "id"
          ? { idDocumentId: uploaded.id }
          : { businessLicenseId: uploaded.id };
      await providersService.setVerificationDocuments(provider.id, docs);
      const next: UploadedDoc = {
        id: uploaded.id,
        url: uploaded.url,
        fileName: uploaded.fileName,
        mimeType: uploaded.mimeType,
      };
      if (kind === "id") setIdDoc(next);
      else setLicenseDoc(next);
    } catch (err) {
      setSaveError(
        err instanceof Error ? err.message : "Upload failed. Try again.",
      );
    } finally {
      setUploadingKind(null);
    }
  };

  const handleDocRemove = async (kind: "id" | "license") => {
    if (!provider) return;
    setUploadingKind(kind);
    setSaveError(null);
    try {
      const docs =
        kind === "id" ? { idDocumentId: null } : { businessLicenseId: null };
      await providersService.setVerificationDocuments(provider.id, docs);
      if (kind === "id") setIdDoc(null);
      else setLicenseDoc(null);
    } catch (err) {
      setSaveError(
        err instanceof Error ? err.message : "Couldn't remove the document.",
      );
    } finally {
      setUploadingKind(null);
    }
  };

  const onSubmitDocuments = () => {
    if (!idDoc) {
      setSaveError(
        "Please upload a government-issued ID so we can verify your account.",
      );
      return;
    }
    setSaveError(null);
    setStep(3);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary-600 border-t-transparent" />
      </div>
    );
  }

  return (
    <>
      {/* Progress */}
      <div className="mb-8">
        <div className="flex items-center gap-2">
          {STEPS.map((label, i) => (
            <div key={label} className="flex flex-1 items-center gap-2">
              <div
                className={cn(
                  "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-bold",
                  i < step
                    ? "bg-primary-600 text-white"
                    : i === step
                      ? "border-2 border-primary-600 text-primary-600"
                      : "border-2 border-gray-200 text-gray-400",
                )}
              >
                {i < step ? <CheckCircle className="h-4 w-4" /> : i + 1}
              </div>
              {i < STEPS.length - 1 && (
                <div
                  className={cn(
                    "h-0.5 flex-1",
                    i < step ? "bg-primary-600" : "bg-gray-200",
                  )}
                />
              )}
            </div>
          ))}
        </div>
        <div className="mt-2 flex justify-between text-xs text-gray-500">
          {STEPS.map((label) => (
            <span key={label}>{label}</span>
          ))}
        </div>
      </div>

      {/* Step 0 — Professional profile */}
      {step === 0 && (
        <>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary-600">
            Step 1 of 3
          </p>
          <h1 className="mt-1 font-sans text-2xl font-bold tracking-tight text-gray-900">
            Set up your{" "}
            <span className="italic text-primary-600">provider profile.</span>
          </h1>
          <p className="mt-2 text-sm text-gray-600">
            Help customers understand what you do and how to work with you.
          </p>

          <form
            onSubmit={handleSubmit(onSubmitProfile)}
            className="mt-6 space-y-4"
          >
            {saveError && (
              <div className="rounded-xl border-2 border-red-100 bg-red-50 p-3 text-sm font-semibold text-red-700">
                {saveError}
              </div>
            )}

            {/* Profile photo */}
            <div className="flex items-center gap-4 rounded-xl border-2 border-gray-200 bg-white p-4">
              <div className="relative">
                <Avatar size="xl" src={user?.profileImage} name={user?.name} />
                {uploadingAvatar && (
                  <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40">
                    <Spinner size="sm" />
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-gray-900">
                  Profile photo
                </p>
                <p className="mt-0.5 text-xs text-gray-500">
                  A clear headshot helps customers trust you. JPG or PNG, up to
                  10 MB.
                </p>
                <input
                  ref={avatarInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleAvatarUpload}
                />
                <button
                  type="button"
                  onClick={() => avatarInputRef.current?.click()}
                  disabled={uploadingAvatar}
                  className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 transition-colors hover:border-primary-400 hover:text-primary-700 disabled:opacity-50"
                >
                  <Camera className="h-3.5 w-3.5" />
                  {user?.profileImage ? "Change photo" : "Upload photo"}
                </button>
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-semibold text-gray-700">
                About your services
              </label>
              <div className="relative">
                <FileText className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <textarea
                  {...register("bio")}
                  rows={4}
                  placeholder="Describe what you do, how long you've been doing it, and what makes you different. Be honest and specific."
                  className={cn(
                    "w-full resize-none rounded-xl border-2 bg-white py-3 pl-10 pr-4 text-sm text-gray-900 placeholder-gray-400 transition-colors focus:border-primary-500 focus:outline-none",
                    errors.bio ? "border-red-400" : "border-gray-200",
                  )}
                />
              </div>
              {errors.bio && (
                <p className="mt-1 text-xs text-red-600">
                  {errors.bio.message}
                </p>
              )}
            </div>

            {/* Service area — full Ghana-wide searchable picker (Nominatim)
                plus a "Use my location" auto-detect that drops a precise GPS
                pin. The picker covers every town/suburb in Ghana so providers
                outside the big cities aren't stuck. */}
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-gray-700">
                Where do you work from?
              </label>
              <LocationPicker
                value={watchedLocation}
                onSelect={(loc: PickedLocation) => {
                  setValue("location", loc.label, { shouldValidate: true });
                  setCoords({ lat: loc.lat, lng: loc.lng });
                  setGeoStatus("ready");
                }}
                onClear={() => {
                  setValue("location", "", { shouldValidate: true });
                  setCoords(null);
                  setGeoStatus("idle");
                }}
                showDetect
                onDetect={detectLocation}
                detecting={geoStatus === "locating"}
                error={errors.location?.message}
                placeholder="Search any town in Ghana — e.g. Tarkwa, Kasoa, Bibiani…"
              />
              {geoStatus === "ready" && coords && (
                <p className="mt-1 text-xs text-success-700">
                  📍 Pinned on the map (lat {coords.lat.toFixed(4)}, lng{" "}
                  {coords.lng.toFixed(4)}).
                </p>
              )}
              {geoStatus === "denied" && (
                <p className="mt-1 text-xs text-red-600">
                  You blocked location access. Search for your area manually, or
                  unblock the site in your browser&apos;s site settings.
                </p>
              )}
              {(geoStatus === "unavailable" || geoStatus === "timeout") && (
                <p className="mt-1 text-xs text-gray-500">
                  Couldn&apos;t get your location automatically — search for
                  your area instead.
                </p>
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                label="Years of experience"
                type="number"
                min={0}
                max={60}
                leftIcon={<Clock className="h-4 w-4" />}
                error={errors.yearsExperience?.message}
                {...register("yearsExperience")}
              />
              <Input
                label="Service radius (km)"
                type="number"
                min={1}
                max={200}
                leftIcon={<Navigation className="h-4 w-4" />}
                error={errors.serviceRadiusKm?.message}
                {...register("serviceRadiusKm")}
              />
            </div>

            <Input
              label="Phone number"
              type="tel"
              placeholder="+233 XX XXX XXXX"
              leftIcon={<Phone className="h-4 w-4" />}
              error={errors.phone?.message}
              {...register("phone")}
            />

            <p className="text-xs text-gray-500">
              No hourly-rate field — pricing is negotiated directly with each
              customer per job.
            </p>

            <Button
              type="submit"
              className="w-full"
              isLoading={isSaving}
              rightIcon={<ArrowRight className="h-4 w-4" />}
            >
              Save and continue
            </Button>
          </form>
        </>
      )}

      {/* Step 1 — Categories */}
      {step === 1 && (
        <>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary-600">
            Step 2 of 3
          </p>
          <h1 className="mt-1 font-sans text-2xl font-bold tracking-tight text-gray-900">
            What services do{" "}
            <span className="italic text-primary-600">you offer?</span>
          </h1>
          <p className="mt-2 text-sm text-gray-600">
            Pick up to 3 categories. Customers search by category, so choose the
            ones that best match what you do.
          </p>

          {saveError && (
            <div className="mt-4 rounded-xl border-2 border-red-100 bg-red-50 p-3 text-sm font-semibold text-red-700">
              {saveError}
            </div>
          )}

          <div className="mt-6">
            {catLoading ? (
              <div className="grid grid-cols-2 gap-3">
                {[...Array(8)].map((_, i) => (
                  <div
                    key={i}
                    className="h-14 animate-pulse rounded-xl bg-gray-100"
                  />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {categories.map((cat) => {
                  const selected = selectedCategoryIds.includes(cat.id);
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => toggleCategory(cat.id)}
                      className={cn(
                        "flex items-center gap-3 rounded-xl border-2 px-4 py-3 text-left text-sm font-semibold transition-all",
                        selected
                          ? "border-primary-500 bg-primary-50 text-primary-700"
                          : "border-gray-200 bg-white text-gray-700 hover:border-gray-300",
                      )}
                    >
                      <Tag
                        className={cn(
                          "h-4 w-4 shrink-0",
                          selected ? "text-primary-600" : "text-gray-400",
                        )}
                      />
                      <span className="truncate">{cat.name}</span>
                      {selected && (
                        <CheckCircle className="ml-auto h-4 w-4 shrink-0 text-primary-600" />
                      )}
                    </button>
                  );
                })}
              </div>
            )}

            {selectedCategoryIds.length > 0 && (
              <p className="mt-3 text-xs text-gray-500">
                {selectedCategoryIds.length}/3 selected
              </p>
            )}
          </div>

          <div className="mt-6 flex gap-3">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => setStep(2)}
            >
              Skip for now
            </Button>
            <Button
              className="flex-1"
              isLoading={isSaving}
              onClick={onSubmitCategories}
              rightIcon={<ArrowRight className="h-4 w-4" />}
            >
              {selectedCategoryIds.length > 0
                ? "Save and continue"
                : "Continue"}
            </Button>
          </div>
        </>
      )}

      {/* Step 2 — Verification documents */}
      {step === 2 && (
        <>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary-600">
            Step 3 of 3
          </p>
          <h1 className="mt-1 flex items-center gap-2 font-sans text-2xl font-bold tracking-tight text-gray-900">
            <ShieldCheck className="h-6 w-6 text-primary-600" />
            Verify your{" "}
            <span className="italic text-primary-600">identity.</span>
          </h1>
          <p className="mt-2 text-sm text-gray-600">
            Upload a government-issued ID so customers can trust you. If you run
            a registered business, attach the business license too. Both stay
            private and are only seen by our verification team.
          </p>

          {saveError && (
            <div className="mt-4 rounded-xl border-2 border-red-100 bg-red-50 p-3 text-sm font-semibold text-red-700">
              {saveError}
            </div>
          )}

          <div className="mt-6 space-y-4">
            <DocumentUploader
              label="Government-issued ID"
              hint="Required. JPG, PNG, or PDF up to 10MB."
              required
              doc={idDoc}
              busy={uploadingKind === "id"}
              onUpload={(f) => handleDocUpload(f, "id")}
              onRemove={() => handleDocRemove("id")}
              inputRef={idInputRef}
            />
            <DocumentUploader
              label="Business license"
              hint="Optional. Helps with faster verification if you run a business."
              doc={licenseDoc}
              busy={uploadingKind === "license"}
              onUpload={(f) => handleDocUpload(f, "license")}
              onRemove={() => handleDocRemove("license")}
              inputRef={licenseInputRef}
            />
          </div>

          <div className="mt-6 flex gap-3">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => setStep(1)}
            >
              Back
            </Button>
            <Button
              className="flex-1"
              onClick={onSubmitDocuments}
              disabled={!idDoc}
              rightIcon={<ArrowRight className="h-4 w-4" />}
            >
              Continue
            </Button>
          </div>
        </>
      )}

      {/* Step 3 — Success */}
      {step === 3 && (
        <SuccessStep
          provider={provider}
          user={user}
          idDoc={idDoc}
          licenseDoc={licenseDoc}
          selectedCategoryIds={selectedCategoryIds}
          onGoDashboard={() => router.push("/dashboard")}
        />
      )}
    </>
  );
}

/**
 * Final onboarding screen. Shows a profile-completion meter + a punch list
 * of next steps. Critically, points the user at `/services` for the gallery
 * upload — first-time providers had no way to discover that location before.
 */
function SuccessStep({
  provider,
  user,
  idDoc,
  licenseDoc,
  selectedCategoryIds,
  onGoDashboard,
}: {
  provider: Provider | null;
  user: { profileImage?: string } | null;
  idDoc: UploadedDoc | null;
  licenseDoc: UploadedDoc | null;
  selectedCategoryIds: string[];
  onGoDashboard: () => void;
}) {
  // Each item is one milestone toward a "complete" profile. Weighted equally
  // so the percentage is easy to reason about.
  const checklist: { label: string; done: boolean; nextHref?: string }[] = [
    { label: "Profile bio + service area", done: !!provider?.bio },
    { label: "Profile photo", done: !!user?.profileImage },
    {
      label: "At least one service category",
      done: selectedCategoryIds.length > 0,
      nextHref: "/services",
    },
    { label: "Government-issued ID uploaded", done: !!idDoc },
    {
      label: "Business license (optional, speeds verification)",
      done: !!licenseDoc,
    },
    {
      label: "Work gallery — upload 3–6 photos on /services",
      done: (provider?.gallery?.length ?? 0) >= 3,
      nextHref: "/services",
    },
  ];
  const completed = checklist.filter((c) => c.done).length;
  const pct = Math.round((completed / checklist.length) * 100);

  return (
    <div>
      <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-primary-50">
        <CheckCircle className="h-10 w-10 text-primary-600" />
      </div>
      <p className="text-center text-xs font-bold uppercase tracking-[0.18em] text-primary-600">
        Profile created
      </p>
      <h1 className="mt-2 text-center font-sans text-2xl font-bold tracking-tight text-gray-900">
        You&apos;re ready to{" "}
        <span className="italic text-primary-600">get customers.</span>
      </h1>
      <p className="mt-3 text-center text-sm text-gray-600">
        Your profile is submitted. Once an admin approves your verification
        documents (usually 1–2 business days), customers can discover and book
        your services.
      </p>

      {/* Completion meter */}
      <div className="mt-8 rounded-2xl border-2 border-primary-100 bg-primary-50/40 p-5">
        <div className="flex items-baseline justify-between">
          <p className="text-sm font-bold text-gray-900">Profile completion</p>
          <p className="text-2xl font-bold text-primary-700">{pct}%</p>
        </div>
        <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-primary-100">
          <div
            className="h-full rounded-full bg-primary-600 transition-[width]"
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="mt-3 text-xs text-gray-600">
          {pct === 100
            ? "Beautiful — your profile looks great."
            : pct >= 66
              ? "Almost there. Finish the items below to maximise booking trust."
              : "Profiles with gallery photos book ~3× more often."}
        </p>
      </div>

      {/* Checklist */}
      <Card className="mt-4">
        <CardContent className="p-4">
          <ul className="space-y-2 text-sm">
            {checklist.map((item) => (
              <li
                key={item.label}
                className="flex items-start gap-2 text-gray-700"
              >
                {item.done ? (
                  <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-green-500" />
                ) : (
                  <Clock className="mt-0.5 h-4 w-4 shrink-0 text-gray-300" />
                )}
                <span className={cn(item.done && "text-gray-500")}>
                  {item.label}
                </span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {/* Gallery nudge — first-time providers don't know where it lives */}
      {(provider?.gallery?.length ?? 0) < 3 && (
        <div className="mt-4 rounded-2xl border-2 border-amber-200 bg-amber-50 p-4">
          <div className="flex items-start gap-3">
            <ImageIcon className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-amber-900">
                Add your work gallery next
              </p>
              <p className="mt-1 text-xs text-amber-800">
                Customers trust providers with photos of past work. Head to{" "}
                <strong>Services</strong> in the sidebar (or the link below) and
                use the &ldquo;Gallery&rdquo; uploader to drop 3–6 photos.
              </p>
              <Button
                size="sm"
                className="mt-3"
                onClick={() => (window.location.href = "/services")}
                rightIcon={<ArrowRight className="h-4 w-4" />}
              >
                Add gallery photos
              </Button>
            </div>
          </div>
        </div>
      )}

      <Button
        className="mt-6 w-full"
        rightIcon={<ArrowRight className="h-4 w-4" />}
        onClick={onGoDashboard}
      >
        Go to my dashboard
      </Button>
    </div>
  );
}

function DocumentUploader({
  label,
  hint,
  required,
  doc,
  busy,
  onUpload,
  onRemove,
  inputRef,
}: {
  label: string;
  hint: string;
  required?: boolean;
  doc: UploadedDoc | null;
  busy: boolean;
  onUpload: (file: File) => void;
  onRemove: () => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
}) {
  const isImage = doc ? doc.mimeType.startsWith("image/") : false;

  return (
    <div className="rounded-xl border-2 border-gray-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-gray-900">
            {label}
            {required && <span className="ml-1 text-red-500">*</span>}
          </p>
          <p className="mt-0.5 text-xs text-gray-500">{hint}</p>
        </div>
        {doc && !busy && (
          <button
            type="button"
            onClick={onRemove}
            className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-red-500"
            aria-label="Remove document"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className="mt-3">
        {doc ? (
          <div className="flex items-center gap-3 rounded-lg bg-gray-50 p-3">
            {isImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={doc.url}
                alt={label}
                className="h-16 w-16 rounded-lg object-cover"
              />
            ) : (
              <div className="flex h-16 w-16 items-center justify-center rounded-lg bg-primary-50">
                <FileText className="h-7 w-7 text-primary-600" />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-gray-900">
                {doc.fileName}
              </p>
              <a
                href={doc.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-semibold text-primary-600 hover:underline"
              >
                View uploaded file
              </a>
            </div>
            <CheckCircle className="h-5 w-5 shrink-0 text-green-500" />
          </div>
        ) : (
          <label
            className={cn(
              "flex cursor-pointer items-center justify-center gap-2 rounded-lg border-2 border-dashed py-4 text-sm font-semibold transition-colors",
              busy
                ? "border-gray-200 text-gray-400"
                : "border-gray-300 text-gray-600 hover:border-primary-400 hover:bg-primary-50 hover:text-primary-700",
            )}
          >
            <input
              ref={inputRef}
              type="file"
              accept="image/*,application/pdf"
              className="hidden"
              disabled={busy}
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (file) onUpload(file);
              }}
            />
            {busy ? (
              <Spinner size="sm" />
            ) : (
              <>
                <Upload className="h-4 w-4" />
                <span>Choose file</span>
                <ImageIcon className="h-4 w-4 opacity-60" />
              </>
            )}
          </label>
        )}
      </div>
    </div>
  );
}
