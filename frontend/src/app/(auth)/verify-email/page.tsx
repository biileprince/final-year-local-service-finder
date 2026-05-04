"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, AlertCircle, Loader2, MailCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { authService } from "@/lib/api";

type Status = "loading" | "success" | "error";

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={null}>
      <VerifyEmailContent />
    </Suspense>
  );
}

function VerifyEmailContent() {
  const params = useSearchParams();
  const token = params.get("token");
  const [status, setStatus] = useState<Status>(token ? "loading" : "error");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setErrorMessage("No verification token was provided.");
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        await authService.verifyEmail(token);
        if (!cancelled) setStatus("success");
      } catch (err) {
        if (cancelled) return;
        setErrorMessage(
          err instanceof Error
            ? err.message
            : "Couldn't verify your email. The link may have expired.",
        );
        setStatus("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  if (status === "loading") {
    return (
      <div className="mx-auto w-full max-w-md text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-primary-50">
          <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
        </div>
        <h1 className="mt-6 font-display text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
          Verifying your email…
        </h1>
        <p className="mt-3 text-gray-600">
          Just a moment while we confirm your address.
        </p>
      </div>
    );
  }

  if (status === "success") {
    return (
      <div className="mx-auto w-full max-w-md">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-green-50">
          <CheckCircle2 className="h-8 w-8 text-green-600" />
        </div>
        <h1 className="mt-6 font-display text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl">
          Email <span className="italic text-primary-600">verified.</span>
        </h1>
        <p className="mt-3 text-gray-600">
          Your account is fully activated. You&apos;re all set to book and
          message service providers.
        </p>
        <div className="mt-8 flex flex-wrap items-center gap-3">
          <Button asChild>
            <Link href="/dashboard">Go to dashboard</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/search">Browse service providers</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-md">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-red-50">
        <AlertCircle className="h-8 w-8 text-red-600" />
      </div>
      <h1 className="mt-6 font-display text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl">
        Verification failed.
      </h1>
      <p className="mt-3 text-gray-600">
        {errorMessage ?? "We couldn't verify your email."}
      </p>

      <div className="mt-8 rounded-2xl border-2 border-gray-100 bg-gray-50 p-5 text-sm text-gray-600">
        <div className="flex items-start gap-3">
          <MailCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary-500" />
          <div>
            <p className="font-bold text-gray-900">Need a new link?</p>
            <p className="mt-1">
              Login and request a fresh verification email from your settings.
            </p>
          </div>
        </div>
      </div>

      <div className="mt-8 flex flex-wrap items-center gap-3">
        <Button asChild>
          <Link href="/login">Login</Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href="/">Back home</Link>
        </Button>
      </div>
    </div>
  );
}
