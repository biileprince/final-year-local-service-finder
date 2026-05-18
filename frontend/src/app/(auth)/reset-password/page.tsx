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
  KeyRound,
  ArrowRight,
  CheckCircle2,
  Mail,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { authService } from "@/lib/api";

const schema = z
  .object({
    email: z.string().email("Enter a valid email address"),
    code: z
      .string()
      .trim()
      .regex(/^\d{6}$/, "Enter the 6-digit code from your email"),
    password: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .regex(/[A-Z]/, "Must contain an uppercase letter")
      .regex(/[a-z]/, "Must contain a lowercase letter")
      .regex(/[0-9]/, "Must contain a number"),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });
type FormData = z.infer<typeof schema>;

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordForm />
    </Suspense>
  );
}

function ResetPasswordForm() {
  const router = useRouter();
  const params = useSearchParams();
  const prefilledEmail = params.get("email") ?? "";
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { email: prefilledEmail },
  });

  const onSubmit = async ({ email, code, password }: FormData) => {
    setSubmitting(true);
    setSubmitError(null);
    try {
      await authService.resetPassword(email, code.trim(), password);
      setSuccess(true);
      setTimeout(() => router.push("/login"), 2500);
    } catch (err) {
      setSubmitError(
        err instanceof Error
          ? err.message
          : "Couldn't reset password. The code may have expired.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (success) {
    return (
      <div className="mx-auto w-full max-w-md">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-green-50">
          <CheckCircle2 className="h-8 w-8 text-green-600" />
        </div>
        <h1 className="mt-6 font-sans text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">
          Password <span className="italic text-primary-600">updated.</span>
        </h1>
        <p className="mt-3 text-gray-600">
          Your password was reset successfully. Redirecting you to login...
        </p>
        <Button asChild className="mt-8">
          <Link href="/login">Login now</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-md">
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary-600">
        Reset password
      </p>
      <h1 className="mt-2 font-sans text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">
        Enter your code &amp; choose a{" "}
        <span className="italic text-primary-600">new password.</span>
      </h1>
      <p className="mt-3 text-gray-600">
        We emailed you a 6-digit code. It expires in 15 minutes — request a new
        one from the{" "}
        <Link
          href="/forgot-password"
          className="font-semibold text-primary-600 hover:underline"
        >
          forgot password
        </Link>{" "}
        page if it ran out.
      </p>

      <form onSubmit={handleSubmit(onSubmit)} className="mt-8 space-y-5">
        {submitError && (
          <div
            role="alert"
            className="rounded-xl border-2 border-red-100 bg-red-50 p-3 text-sm font-semibold text-red-700"
          >
            {submitError}
          </div>
        )}

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
          label="6-digit code"
          type="text"
          inputMode="numeric"
          maxLength={6}
          autoComplete="one-time-code"
          placeholder="123456"
          leftIcon={<ShieldCheck className="h-5 w-5" />}
          error={errors.code?.message}
          {...register("code")}
        />

        <Input
          label="New password"
          type={showPassword ? "text" : "password"}
          autoComplete="new-password"
          placeholder="Enter your new password"
          leftIcon={<KeyRound className="h-5 w-5" />}
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
          label="Confirm new password"
          type={showConfirm ? "text" : "password"}
          autoComplete="new-password"
          placeholder="Enter your new password again"
          leftIcon={<KeyRound className="h-5 w-5" />}
          error={errors.confirmPassword?.message}
          rightIcon={
            <button
              type="button"
              onClick={() => setShowConfirm((v) => !v)}
              className="text-gray-400 transition-colors hover:text-gray-700"
              aria-label={showConfirm ? "Hide password" : "Show password"}
            >
              {showConfirm ? (
                <EyeOff className="h-5 w-5" />
              ) : (
                <Eye className="h-5 w-5" />
              )}
            </button>
          }
          {...register("confirmPassword")}
        />

        <Button
          type="submit"
          size="lg"
          className="w-full"
          isLoading={submitting}
        >
          Update password
          <ArrowRight className="h-4 w-4" />
        </Button>
      </form>
    </div>
  );
}
