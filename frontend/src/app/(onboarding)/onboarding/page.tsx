"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  CheckCircle,
  MapPin,
  Clock,
  DollarSign,
  FileText,
  ArrowRight,
  Tag,
  ShieldCheck,
  Upload,
  X,
  Image as ImageIcon,
  Camera,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { Avatar } from "@/components/ui/avatar";
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
  location: z.string().min(2, "Enter your city or neighbourhood"),
  yearsExperience: z.coerce
    .number()
    .min(0, "Must be 0 or more")
    .max(60, "Please enter a valid number"),
  hourlyRate: z.coerce
    .number()
    .min(1, "Enter your hourly rate in GHS")
    .max(10000, "Please enter a realistic rate"),
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
  } = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      bio: "",
      location: "",
      yearsExperience: 1,
      hourlyRate: 50,
    },
  });

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

  const handleAvatarUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
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
      const updated = await providersService.updateProfile({
        bio: data.bio,
        location: data.location,
        yearsExperience: data.yearsExperience,
        hourlyRate: data.hourlyRate,
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
        kind === "id"
          ? { idDocumentId: null }
          : { businessLicenseId: null };
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
                <Avatar
                  size="xl"
                  src={user?.profileImage}
                  name={user?.name}
                />
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

            <Input
              label="Your city or neighbourhood"
              placeholder="e.g. Accra, East Legon"
              leftIcon={<MapPin className="h-4 w-4" />}
              error={errors.location?.message}
              {...register("location")}
            />

            <div className="grid grid-cols-2 gap-4">
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
                label="Hourly rate (GHS)"
                type="number"
                min={1}
                leftIcon={<DollarSign className="h-4 w-4" />}
                error={errors.hourlyRate?.message}
                {...register("hourlyRate")}
              />
            </div>

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
              {selectedCategoryIds.length > 0 ? "Save and continue" : "Continue"}
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
        <div className="text-center">
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-primary-50">
            <CheckCircle className="h-10 w-10 text-primary-600" />
          </div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary-600">
            Profile created
          </p>
          <h1 className="mt-2 font-sans text-2xl font-bold tracking-tight text-gray-900">
            You&apos;re ready to{" "}
            <span className="italic text-primary-600">get customers.</span>
          </h1>
          <p className="mt-3 text-sm text-gray-600">
            Your profile is submitted. Once an admin approves your verification
            documents (usually 1–2 business days), customers can discover and
            book your services.
          </p>

          <div className="mt-8 space-y-3">
            <Card>
              <CardContent className="p-4 text-left">
                <ul className="space-y-2 text-sm text-gray-600">
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    Profile info saved
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    {idDoc ? "ID document submitted" : "ID document pending"}
                  </li>
                  <li className="flex items-center gap-2 text-gray-400">
                    <Clock className="h-4 w-4" />
                    Verification review in progress (1–2 business days)
                  </li>
                </ul>
              </CardContent>
            </Card>

            <Button
              className="w-full"
              rightIcon={<ArrowRight className="h-4 w-4" />}
              onClick={() => router.push("/dashboard")}
            >
              Go to my dashboard
            </Button>
          </div>
        </div>
      )}
    </>
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
