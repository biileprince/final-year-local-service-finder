"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Eye, EyeOff, Mail, User, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks";

const registerSchema = z
  .object({
    name: z.string().min(2, "Name must be at least 2 characters"),
    email: z.string().email("Please enter a valid email address"),
    phone: z.string().optional(),
    password: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
      .regex(/[a-z]/, "Password must contain at least one lowercase letter")
      .regex(/[0-9]/, "Password must contain at least one number"),
    confirmPassword: z.string(),
    role: z.enum(["CUSTOMER", "PROVIDER"]),
    acceptTerms: z.literal(true, {
      errorMap: () => ({ message: "You must accept the terms and conditions" }),
    }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

type RegisterFormData = z.infer<typeof registerSchema>;

export default function RegisterPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const defaultRole = searchParams.get("role") === "provider" ? "PROVIDER" : "CUSTOMER";
  const { register: registerUser, isLoading, error, clearError } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      role: defaultRole,
    },
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
      // Error is handled by the auth store
    }
  };

  return (
    <div className="mx-auto w-full max-w-sm">
      <div className="mb-8">
        <Link href="/" className="flex items-center gap-2 lg:hidden">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-600">
            <span className="text-lg font-bold text-white">L</span>
          </div>
          <span className="text-xl font-bold text-secondary-900">LocalService</span>
        </Link>
        <h1 className="mt-6 text-2xl font-bold text-secondary-900 lg:mt-0">
          Create your account
        </h1>
        <p className="mt-2 text-secondary-600">
          Join thousands of users finding local services
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        {error && (
          <div className="rounded-lg bg-error-50 p-4 text-sm text-error-600">
            {error}
          </div>
        )}

        {/* Role Selection */}
        <div>
          <label className="mb-2 block text-sm font-medium text-secondary-700">
            I want to
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label
              className={`flex cursor-pointer items-center justify-center rounded-lg border-2 p-4 transition-colors ${
                selectedRole === "CUSTOMER"
                  ? "border-primary-600 bg-primary-50"
                  : "border-secondary-200 hover:border-secondary-300"
              }`}
            >
              <input
                type="radio"
                value="CUSTOMER"
                className="sr-only"
                {...register("role")}
              />
              <div className="text-center">
                <span className="text-2xl">🔍</span>
                <p className="mt-1 text-sm font-medium text-secondary-900">
                  Find Services
                </p>
              </div>
            </label>
            <label
              className={`flex cursor-pointer items-center justify-center rounded-lg border-2 p-4 transition-colors ${
                selectedRole === "PROVIDER"
                  ? "border-primary-600 bg-primary-50"
                  : "border-secondary-200 hover:border-secondary-300"
              }`}
            >
              <input
                type="radio"
                value="PROVIDER"
                className="sr-only"
                {...register("role")}
              />
              <div className="text-center">
                <span className="text-2xl">🛠️</span>
                <p className="mt-1 text-sm font-medium text-secondary-900">
                  Offer Services
                </p>
              </div>
            </label>
          </div>
        </div>

        <Input
          label="Full name"
          placeholder="John Doe"
          leftIcon={<User className="h-5 w-5" />}
          error={errors.name?.message}
          {...register("name")}
        />

        <Input
          label="Email address"
          type="email"
          placeholder="you@example.com"
          leftIcon={<Mail className="h-5 w-5" />}
          error={errors.email?.message}
          {...register("email")}
        />

        <Input
          label="Phone number (optional)"
          type="tel"
          placeholder="+233 XX XXX XXXX"
          leftIcon={<Phone className="h-5 w-5" />}
          error={errors.phone?.message}
          {...register("phone")}
        />

        <Input
          label="Password"
          type={showPassword ? "text" : "password"}
          placeholder="Create a strong password"
          error={errors.password?.message}
          hint="At least 8 characters with uppercase, lowercase, and number"
          rightIcon={
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="text-secondary-400 hover:text-secondary-600"
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
          placeholder="Confirm your password"
          error={errors.confirmPassword?.message}
          rightIcon={
            <button
              type="button"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              className="text-secondary-400 hover:text-secondary-600"
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
          <label className="flex items-start gap-2">
            <input
              type="checkbox"
              className="mt-1 h-4 w-4 rounded border-secondary-300 text-primary-600 focus:ring-primary-500"
              {...register("acceptTerms")}
            />
            <span className="text-sm text-secondary-600">
              I agree to the{" "}
              <Link href="/terms" className="text-primary-600 hover:underline">
                Terms of Service
              </Link>{" "}
              and{" "}
              <Link href="/privacy" className="text-primary-600 hover:underline">
                Privacy Policy
              </Link>
            </span>
          </label>
          {errors.acceptTerms && (
            <p className="mt-1 text-sm text-error-500">
              {errors.acceptTerms.message}
            </p>
          )}
        </div>

        <Button type="submit" className="w-full" size="lg" isLoading={isLoading}>
          Create account
        </Button>
      </form>

      <p className="mt-8 text-center text-sm text-secondary-600">
        Already have an account?{" "}
        <Link
          href="/login"
          className="font-medium text-primary-600 hover:text-primary-700"
        >
          Sign in
        </Link>
      </p>
    </div>
  );
}
