"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { authService } from "@/lib/api";
import { useAuthStore } from "@/store/auth-store";

export default function OAuthReturnPage() {
  return (
    <Suspense fallback={<CenteredSpinner />}>
      <OAuthReturn />
    </Suspense>
  );
}

function OAuthReturn() {
  const router = useRouter();
  const params = useSearchParams();
  const code = params.get("code");
  const returnUrl = params.get("returnUrl");
  const fetchUser = useAuthStore((s) => s.fetchUser);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!code) {
      setError(
        "Missing sign-in code. Try Continue with Google from the login page again.",
      );
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        await authService.googleExchange(code);
        await fetchUser();
        if (cancelled) return;
        router.replace(returnUrl || "/dashboard");
      } catch (err) {
        if (cancelled) return;
        setError(
          err instanceof Error
            ? err.message
            : "We couldn't complete your sign-in. Please try again.",
        );
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [code, returnUrl, router, fetchUser]);

  if (error) {
    return (
      <div className="mx-auto w-full max-w-md">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-red-50">
          <AlertCircle className="h-8 w-8 text-red-600" />
        </div>
        <h1 className="mt-6 font-sans text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">
          Sign-in failed.
        </h1>
        <p className="mt-3 text-gray-600">{error}</p>
        <Button asChild className="mt-8">
          <Link href="/login">Back to login</Link>
        </Button>
      </div>
    );
  }

  return <CenteredSpinner label="Finishing sign-in…" />;
}

function CenteredSpinner({ label }: { label?: string } = {}) {
  return (
    <div className="mx-auto w-full max-w-md text-center">
      <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary-600" />
      {label && <p className="mt-4 text-sm text-gray-600">{label}</p>}
    </div>
  );
}
