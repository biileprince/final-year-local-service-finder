"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Eye,
  EyeOff,
  Mail,
  User,
  Phone,
  Search as SearchIcon,
  Wrench,
  ArrowRight,
  ArrowLeft,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ContinueWithGoogleButton } from "@/components/auth/google-button";
import { useAuth } from "@/hooks";
import { cn } from "@/lib/utils";

const registerSchema = z
  .object({
    name: z.string().min(2, "Name must be at least 2 characters"),
    email: z.string().email("Please enter a valid email address"),
    phone: z.string().optional(),
    password: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .regex(/[A-Z]/, "Must contain an uppercase letter")
      .regex(/[a-z]/, "Must contain a lowercase letter")
      .regex(/[0-9]/, "Must contain a number"),
    confirmPassword: z.string(),
    role: z.enum(["CUSTOMER", "PROVIDER"]),
    acceptTerms: z.literal(true, {
      errorMap: () => ({ message: "You must accept the terms" }),
    }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

type RegisterFormData = z.infer<typeof registerSchema>;

type Role = "CUSTOMER" | "PROVIDER";

export default function RegisterPage() {
  return (
    <Suspense>
      <RegisterForm />
    </Suspense>
  );
}

function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const roleParam = searchParams.get("role");
  const presetRole: Role | null =
    roleParam === "provider"
      ? "PROVIDER"
      : roleParam === "customer"
        ? "CUSTOMER"
        : null;

  const { register: registerUser, isLoading, error, clearError } = useAuth();
  const [step, setStep] = useState<1 | 2>(presetRole ? 2 : 1);
  const [role, setRole] = useState<Role | null>(presetRole);
  const [pendingRole, setPendingRole] = useState<Role | null>(presetRole);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
    defaultValues: { role: presetRole ?? "CUSTOMER" },
  });

  const onSubmit = async (data: RegisterFormData) => {
    clearError();
    try {
      await registerUser({
        email: data.email,
        password: data.password,
        name: data.name,
        phone: data.phone,
        role: data.role,
      });
      // Send everyone through the verification screen first — backend already
      // emailed a 6-digit code. After verifying, the page routes providers to
      // onboarding and customers to the dashboard.
      router.replace("/verify-email");
    } catch {
      // handled by store
    }
  };

  const goToStep2 = () => {
    if (!pendingRole) return;
    setRole(pendingRole);
    setValue("role", pendingRole);
    setStep(2);
  };

  return (
    <div className="mx-auto w-full max-w-xl">
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary-600">
        Register · Step {step} of 2
      </p>
      <h1 className="mt-2 font-sans text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">
        {step === 1 ? (
          <>
            Choose your{" "}
            <span className="italic text-primary-600">account type.</span>
          </>
        ) : (
          <>
            Tell us about{" "}
            <span className="italic text-primary-600">yourself.</span>
          </>
        )}
      </h1>
      <p className="mt-3 text-gray-600">
        {step === 1
          ? "Are you here to book services, or to offer them? Pick the option that fits — you can't change this later."
          : role === "PROVIDER"
            ? "You're registering as a service provider. We'll walk you through onboarding right after this."
            : "You're registering as a customer. Find and book trusted service providers in minutes."}
      </p>

      {/* Progress bar */}
      <div className="mt-6 flex items-center gap-2">
        <div className="h-1.5 flex-1 rounded-full bg-primary-500" />
        <div
          className={cn(
            "h-1.5 flex-1 rounded-full transition-colors",
            step === 2 ? "bg-primary-500" : "bg-gray-200",
          )}
        />
      </div>

      {step === 1 ? (
        <div className="mt-8 space-y-4">
          <RoleCard
            icon={SearchIcon}
            tag="CUSTOMER"
            title="I'm here to find a service"
            description="Find & book trusted service providers near you"
            bullets={[
              "Browse providers by category",
              "Chat directly with providers",
              "Rate & review after your booking",
            ]}
            active={pendingRole === "CUSTOMER"}
            onClick={() => setPendingRole("CUSTOMER")}
          />
          <RoleCard
            icon={Wrench}
            tag="SERVICE PROVIDER"
            title="I want to offer my services"
            description="List your services and reach new customers"
            bullets={[
              "Showcase your work with a public profile",
              "Manage bookings and availability",
              "Build your reputation through reviews",
            ]}
            active={pendingRole === "PROVIDER"}
            onClick={() => setPendingRole("PROVIDER")}
          />

          <Button
            type="button"
            size="lg"
            className="mt-4 w-full"
            disabled={!pendingRole}
            onClick={goToStep2}
          >
            Continue
            <ArrowRight className="h-4 w-4" />
          </Button>

          <p className="mt-6 text-center text-sm text-gray-600">
            Already have an account?{" "}
            <Link
              href="/login"
              className="font-bold text-primary-600 underline-offset-4 transition-colors hover:underline"
            >
              Login
            </Link>
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} className="mt-8 space-y-4">
          {/* Selected role summary with back affordance */}
          <div className="flex items-center justify-between rounded-2xl border-2 border-primary-100 bg-primary-50 p-3">
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary-500 text-white">
                {role === "PROVIDER" ? (
                  <Wrench className="h-4 w-4" />
                ) : (
                  <SearchIcon className="h-4 w-4" />
                )}
              </span>
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-primary-700">
                  Registering as
                </p>
                <p className="text-sm font-bold text-gray-900">
                  {role === "PROVIDER" ? "Service Provider" : "Customer"}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setStep(1)}
              className="flex items-center gap-1 text-xs font-semibold text-primary-700 underline-offset-4 hover:underline"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Change
            </button>
          </div>

          {error && (
            <div
              role="alert"
              className="rounded-xl border-2 border-red-100 bg-red-50 p-3 text-sm font-semibold text-red-700"
            >
              {error}
            </div>
          )}

          <ContinueWithGoogleButton
            role={role ?? undefined}
            label={`Continue with Google as ${role === "PROVIDER" ? "a provider" : "a customer"}`}
          />

          <div className="my-2 flex items-center gap-3 text-xs font-bold uppercase tracking-[0.15em] text-gray-400">
            <span className="h-px flex-1 bg-gray-200" />
            Or with email
            <span className="h-px flex-1 bg-gray-200" />
          </div>

          <input type="hidden" {...register("role")} />

          <Input
            label="Full name"
            placeholder="Enter your full name"
            autoComplete="name"
            leftIcon={<User className="h-5 w-5" />}
            error={errors.name?.message}
            {...register("name")}
          />

          <Input
            label="Email address"
            type="email"
            autoComplete="email"
            placeholder="Enter your email address"
            leftIcon={<Mail className="h-5 w-5" />}
            error={errors.email?.message}
            {...register("email")}
          />

          <Input
            label="Phone (optional)"
            type="tel"
            autoComplete="tel"
            placeholder="+233 XX XXX XXXX"
            leftIcon={<Phone className="h-5 w-5" />}
            error={errors.phone?.message}
            {...register("phone")}
          />

          <Input
            label="Password"
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
            placeholder="Enter your password"
            hint="Use uppercase, lowercase and a number."
            error={errors.password?.message}
            rightIcon={
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="text-gray-400 transition-colors hover:text-gray-700"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? (
                  <EyeOff className="h-5 w-5" />
                ) : (
                  <Eye className="h-5 w-5" />
                )}
              </button>
            }
            {...register("password")}
          />

          <Input
            label="Confirm password"
            type={showConfirmPassword ? "text" : "password"}
            autoComplete="new-password"
            placeholder="Enter your password again"
            error={errors.confirmPassword?.message}
            rightIcon={
              <button
                type="button"
                onClick={() => setShowConfirmPassword((v) => !v)}
                className="text-gray-400 transition-colors hover:text-gray-700"
                aria-label={
                  showConfirmPassword ? "Hide password" : "Show password"
                }
              >
                {showConfirmPassword ? (
                  <EyeOff className="h-5 w-5" />
                ) : (
                  <Eye className="h-5 w-5" />
                )}
              </button>
            }
            {...register("confirmPassword")}
          />

          <div>
            <label className="flex cursor-pointer items-start gap-2">
              <input
                type="checkbox"
                className="mt-1 h-4 w-4 cursor-pointer rounded border-gray-300 text-primary-500 focus:ring-2 focus:ring-primary-500/30"
                {...register("acceptTerms")}
              />
              <span className="text-sm text-gray-600">
                I agree to the{" "}
                <Link
                  href="/terms"
                  className="font-semibold text-primary-600 hover:underline"
                >
                  Terms of Service
                </Link>{" "}
                and{" "}
                <Link
                  href="/privacy"
                  className="font-semibold text-primary-600 hover:underline"
                >
                  Privacy Policy
                </Link>
                .
              </span>
            </label>
            {errors.acceptTerms && (
              <p className="mt-1 text-sm font-semibold text-red-600">
                {errors.acceptTerms.message}
              </p>
            )}
          </div>

          <Button
            type="submit"
            size="lg"
            className="w-full"
            isLoading={isLoading}
          >
            Create my {role === "PROVIDER" ? "provider" : "customer"} account
            <ArrowRight className="h-4 w-4" />
          </Button>

          <p className="mt-6 text-center text-sm text-gray-600">
            Already have an account?{" "}
            <Link
              href="/login"
              className="font-bold text-primary-600 underline-offset-4 transition-colors hover:underline"
            >
              Login
            </Link>
          </p>
        </form>
      )}
    </div>
  );
}

function RoleCard({
  icon: Icon,
  tag,
  title,
  description,
  bullets,
  active,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string }>;
  tag: string;
  title: string;
  description: string;
  bullets: string[];
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "group relative flex w-full items-start gap-4 rounded-2xl border-2 p-5 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2",
        active
          ? "border-primary-500 bg-primary-50 shadow-md shadow-primary-500/20"
          : "border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm",
      )}
    >
      <span
        className={cn(
          "flex h-12 w-12 shrink-0 items-center justify-center rounded-xl transition-colors",
          active
            ? "bg-primary-500 text-white shadow-md shadow-primary-500/30"
            : "bg-gray-100 text-gray-600 group-hover:bg-gray-200",
        )}
      >
        <Icon className="h-6 w-6" />
      </span>
      <div className="flex-1">
        <p
          className={cn(
            "text-[10px] font-bold uppercase tracking-[0.18em]",
            active ? "text-primary-700" : "text-gray-400",
          )}
        >
          {tag}
        </p>
        <p className="mt-0.5 text-base font-bold text-gray-900">{title}</p>
        <p className="mt-1 text-sm text-gray-600">{description}</p>
        <ul className="mt-3 space-y-1.5">
          {bullets.map((b) => (
            <li
              key={b}
              className="flex items-center gap-2 text-xs text-gray-600"
            >
              <Check
                className={cn(
                  "h-3.5 w-3.5 shrink-0",
                  active ? "text-primary-600" : "text-gray-400",
                )}
              />
              {b}
            </li>
          ))}
        </ul>
      </div>
      <span
        className={cn(
          "absolute right-4 top-4 flex h-5 w-5 items-center justify-center rounded-full border-2 transition-colors",
          active
            ? "border-primary-500 bg-primary-500 text-white"
            : "border-gray-300 bg-white",
        )}
      >
        {active && <Check className="h-3 w-3" strokeWidth={3} />}
      </span>
    </button>
  );
}
