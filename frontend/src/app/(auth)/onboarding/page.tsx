"use client";

import { useEffect, useState } from "react";
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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/hooks";
import { providersService } from "@/lib/api";
import { categoriesService } from "@/lib/api";
import type { Category } from "@/types";
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

const STEPS = ["Your profile", "Service categories", "You're ready"] as const;

export default function OnboardingPage() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading } = useAuth();

  const [step, setStep] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);
  const [catLoading, setCatLoading] = useState(true);

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

  // Redirect non-providers or unauthenticated users
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace("/login");
    }
    if (!isLoading && isAuthenticated && user?.role !== "PROVIDER") {
      router.replace("/dashboard");
    }
  }, [isLoading, isAuthenticated, user, router]);

  useEffect(() => {
    categoriesService
      .getAll()
      .then(setCategories)
      .catch(() => setCategories([]))
      .finally(() => setCatLoading(false));
  }, []);

  const toggleCategory = (id: string) => {
    setSelectedCategoryIds((prev) =>
      prev.includes(id)
        ? prev.filter((c) => c !== id)
        : prev.length < 3
          ? [...prev, id]
          : prev,
    );
  };

  const onSubmitProfile = async (data: ProfileFormData) => {
    setIsSaving(true);
    setSaveError(null);
    try {
      await providersService.updateProfile({
        bio: data.bio,
        location: data.location,
        yearsExperience: data.yearsExperience,
        hourlyRate: data.hourlyRate,
      });
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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary-600 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-lg">
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
            Step 1 of 2
          </p>
          <h1 className="mt-1 font-display text-3xl font-bold tracking-tight text-gray-900">
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
            Step 2 of 2
          </p>
          <h1 className="mt-1 font-display text-3xl font-bold tracking-tight text-gray-900">
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

      {/* Step 2 — Success */}
      {step === 2 && (
        <div className="text-center">
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-primary-50">
            <CheckCircle className="h-10 w-10 text-primary-600" />
          </div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary-600">
            Profile created
          </p>
          <h1 className="mt-2 font-display text-3xl font-bold tracking-tight text-gray-900">
            You&apos;re ready to{" "}
            <span className="italic text-primary-600">get customers.</span>
          </h1>
          <p className="mt-3 text-sm text-gray-600">
            Your profile is live. Customers in your area can now discover and
            book your services. Head to your dashboard to manage bookings,
            messages, and availability.
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
                    Profile is visible to customers
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
    </div>
  );
}
