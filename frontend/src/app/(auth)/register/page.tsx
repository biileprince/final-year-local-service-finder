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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth, useRedirectIfAuthenticated } from "@/hooks";
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
  const defaultRole =
    searchParams.get("role") === "provider" ? "PROVIDER" : "CUSTOMER";
  useRedirectIfAuthenticated("/dashboard");
  const { register: registerUser, isLoading, error, clearError } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
    defaultValues: { role: defaultRole },
  });

  const selectedRole = watch("role");

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
      router.push(data.role === "PROVIDER" ? "/onboarding" : "/dashboard");
    } catch {
      // handled by store
    }
  };

  return (
    <div className="mx-auto w-full max-w-md">
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary-600">
        Register
      </p>
      <h1 className="mt-1 font-sans text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">
        Register for an{" "}
        <span className="italic text-primary-600">account.</span>
      </h1>
      <p className="mt-2 text-sm text-gray-600">
        Register as a customer to book a service, or register as a service
        provider to list the services you offer and get new customers.
      </p>

      <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-4">
        {error && (
          <div
            role="alert"
            className="rounded-xl border-2 border-red-100 bg-red-50 p-3 text-sm font-semibold text-red-700"
          >
            {error}
          </div>
        )}

        {/* Role chooser */}
        <div>
          <p className="mb-2 text-sm font-semibold text-gray-700">I want to…</p>
          <div className="grid grid-cols-2 gap-3">
            <RoleCard
              icon={SearchIcon}
              title="Find a service provider"
              description="Book trusted service providers"
              active={selectedRole === "CUSTOMER"}
              onClick={() => setValue("role", "CUSTOMER")}
            />
            <RoleCard
              icon={Wrench}
              title="Offer my services"
              description="List my services"
              active={selectedRole === "PROVIDER"}
              onClick={() => setValue("role", "PROVIDER")}
            />
          </div>
          <input type="hidden" {...register("role")} />
        </div>

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
          Register
          <ArrowRight className="h-4 w-4" />
        </Button>
      </form>

      <p className="mt-8 text-center text-sm text-gray-600">
        Already have an account?{" "}
        <Link
          href="/login"
          className="font-bold text-primary-600 underline-offset-4 transition-colors hover:underline"
        >
          Login
        </Link>
      </p>
    </div>
  );
}

function RoleCard({
  icon: Icon,
  title,
  description,
  active,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "group flex flex-col items-start gap-2 rounded-2xl border-2 p-4 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2",
        active
          ? "border-primary-500 bg-primary-50 shadow-md shadow-primary-500/20"
          : "border-gray-200 bg-white hover:border-gray-300",
      )}
    >
      <span
        className={cn(
          "flex h-10 w-10 items-center justify-center rounded-xl transition-colors",
          active
            ? "bg-primary-500 text-white shadow-md shadow-primary-500/30"
            : "bg-gray-100 text-gray-600 group-hover:bg-gray-200",
        )}
      >
        <Icon className="h-5 w-5" />
      </span>
      <div>
        <p className="text-sm font-bold text-gray-900">{title}</p>
        <p className="text-xs text-gray-500">{description}</p>
      </div>
    </button>
  );
}
