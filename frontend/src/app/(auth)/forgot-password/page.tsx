"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Mail, ArrowRight, MailCheck, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { authService } from "@/lib/api";

const schema = z.object({
  email: z.string().email("Please enter a valid email address"),
});
type FormData = z.infer<typeof schema>;

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [submittedEmail, setSubmittedEmail] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const onSubmit = async ({ email }: FormData) => {
    setSubmitting(true);
    setSubmitError(null);
    try {
      await authService.forgotPassword(email);
      setSubmittedEmail(email);
    } catch (err) {
      setSubmitError(
        err instanceof Error
          ? err.message
          : "Something went wrong. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (submittedEmail) {
    return (
      <div className="mx-auto w-full max-w-md">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary-50">
          <MailCheck className="h-8 w-8 text-primary-600" />
        </div>
        <h1 className="mt-6 font-sans text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">
          Check your <span className="italic text-primary-600">inbox.</span>
        </h1>
        <p className="mt-3 text-gray-600">
          If an account exists for{" "}
          <span className="font-bold text-gray-900">{submittedEmail}</span>,
          we&apos;ve sent a 6-digit reset code. It expires in 15 minutes.
        </p>

        <div className="mt-8 rounded-2xl border-2 border-gray-100 bg-gray-50 p-5 text-sm text-gray-600">
          <p className="font-bold text-gray-900">Didn&apos;t receive it?</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>Check your spam or junk folder</li>
            <li>Verify the email is correct</li>
            <li>Allow up to a few minutes for delivery</li>
          </ul>
        </div>

        <div className="mt-8 flex flex-wrap items-center gap-3">
          <Button
            onClick={() =>
              router.push(
                `/reset-password?email=${encodeURIComponent(submittedEmail)}`,
              )
            }
          >
            Enter reset code
            <ArrowRight className="h-4 w-4" />
          </Button>
          <Button variant="outline" onClick={() => setSubmittedEmail(null)}>
            Try another email
          </Button>
          <Button variant="ghost" asChild>
            <Link href="/login">Back to login</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-md">
      <Link
        href="/login"
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-gray-500 transition-colors hover:text-gray-900"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to login
      </Link>

      <p className="mt-6 text-xs font-bold uppercase tracking-[0.18em] text-primary-600">
        Forgot password
      </p>
      <h1 className="mt-2 font-sans text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">
        No worries — let&apos;s{" "}
        <span className="italic text-primary-600">fix that.</span>
      </h1>
      <p className="mt-3 text-gray-600">
        Enter the email tied to your account and we&apos;ll send you a secure
        link to reset your password.
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
        <Button
          type="submit"
          size="lg"
          className="w-full"
          isLoading={submitting}
        >
          Send reset link
          <ArrowRight className="h-4 w-4" />
        </Button>
      </form>
    </div>
  );
}
