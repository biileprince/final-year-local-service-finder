"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  Loader2,
  MailCheck,
  AlertCircle,
  RotateCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { authService } from "@/lib/api";
import { useAuth, useRequireAuth } from "@/hooks";
import { cn } from "@/lib/utils";

const CODE_LENGTH = 6;
const RESEND_COOLDOWN_SECONDS = 60;

export default function VerifyEmailPage() {
  const router = useRouter();
  const { isLoading: authLoading, isAuthenticated } = useRequireAuth();
  const { user, setUser } = useAuth();

  const [digits, setDigits] = useState<string[]>(() =>
    Array.from({ length: CODE_LENGTH }, () => ""),
  );
  const inputsRef = useRef<Array<HTMLInputElement | null>>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [sendStatus, setSendStatus] = useState<
    "idle" | "sending" | "sent" | "error"
  >("idle");
  const [resendCooldown, setResendCooldown] = useState(0);
  const autoSentRef = useRef(false);

  // Auto-send a fresh code the first time the page loads for an unverified
  // user, so they don't have to remember to tap "Resend" before entering one.
  useEffect(() => {
    if (autoSentRef.current) return;
    if (authLoading || !isAuthenticated || !user) return;
    if (user.emailVerifiedAt) return;
    autoSentRef.current = true;
    void resend(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, isAuthenticated, user]);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setTimeout(() => setResendCooldown((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCooldown]);

  const code = digits.join("");
  const isComplete = code.length === CODE_LENGTH && /^\d{6}$/.test(code);

  const focusInput = (i: number) => {
    const el = inputsRef.current[i];
    if (el) el.focus();
  };

  const setDigitAt = (i: number, v: string) => {
    setDigits((prev) => {
      const next = [...prev];
      next[i] = v;
      return next;
    });
  };

  const handleChange = (i: number, raw: string) => {
    const cleaned = raw.replace(/\D/g, "");
    if (!cleaned) {
      setDigitAt(i, "");
      return;
    }
    if (cleaned.length === 1) {
      setDigitAt(i, cleaned);
      if (i < CODE_LENGTH - 1) focusInput(i + 1);
    } else {
      // User typed/pasted multiple digits at once — distribute across cells.
      const chars = cleaned.slice(0, CODE_LENGTH - i).split("");
      setDigits((prev) => {
        const next = [...prev];
        for (let k = 0; k < chars.length; k++) {
          next[i + k] = chars[k]!;
        }
        return next;
      });
      const last = Math.min(i + chars.length, CODE_LENGTH - 1);
      focusInput(last);
    }
  };

  const handleKeyDown = (i: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !digits[i] && i > 0) {
      focusInput(i - 1);
      setDigitAt(i - 1, "");
      e.preventDefault();
    } else if (e.key === "ArrowLeft" && i > 0) {
      focusInput(i - 1);
    } else if (e.key === "ArrowRight" && i < CODE_LENGTH - 1) {
      focusInput(i + 1);
    } else if (e.key === "Enter" && isComplete && !submitting) {
      void submit();
    }
  };

  const handlePaste = (i: number, e: React.ClipboardEvent<HTMLInputElement>) => {
    const text = e.clipboardData.getData("text").replace(/\D/g, "");
    if (!text) return;
    e.preventDefault();
    handleChange(i, text);
  };

  const submit = async () => {
    if (!isComplete) return;
    setSubmitting(true);
    setError(null);
    try {
      await authService.verifyEmail(code);
      if (user) setUser({ ...user, emailVerifiedAt: new Date().toISOString() });
      setSuccess(true);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "That code didn't work. Try again or request a new one.",
      );
      setDigits(Array.from({ length: CODE_LENGTH }, () => ""));
      focusInput(0);
    } finally {
      setSubmitting(false);
    }
  };

  const resend = async (silent = false) => {
    if (resendCooldown > 0) return;
    setSendStatus("sending");
    setError(null);
    try {
      await authService.sendVerification();
      setSendStatus("sent");
      setResendCooldown(RESEND_COOLDOWN_SECONDS);
    } catch (err) {
      setSendStatus("error");
      if (!silent) {
        setError(
          err instanceof Error
            ? err.message
            : "Couldn't send the code. Try again in a moment.",
        );
      }
    }
  };

  // -------------- Render ---------------

  if (authLoading) {
    return (
      <div className="mx-auto w-full max-w-md text-center">
        <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary-600" />
      </div>
    );
  }

  if (!user) return null;

  if (user.emailVerifiedAt && !success) {
    return (
      <div className="mx-auto w-full max-w-md">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-green-50">
          <CheckCircle2 className="h-8 w-8 text-green-600" />
        </div>
        <h1 className="mt-6 font-sans text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">
          Already <span className="italic text-primary-600">verified.</span>
        </h1>
        <p className="mt-3 text-gray-600">
          Your email is already confirmed — nothing more to do here.
        </p>
        <Button asChild className="mt-8">
          <Link href="/dashboard">Go to dashboard</Link>
        </Button>
      </div>
    );
  }

  if (success) {
    const isProvider = user.role === "PROVIDER";
    const primaryHref = isProvider ? "/onboarding" : "/dashboard";
    const primaryLabel = isProvider
      ? "Continue to onboarding"
      : "Go to dashboard";
    return (
      <div className="mx-auto w-full max-w-md">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-green-50">
          <CheckCircle2 className="h-8 w-8 text-green-600" />
        </div>
        <h1 className="mt-6 font-sans text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">
          Email <span className="italic text-primary-600">verified.</span>
        </h1>
        <p className="mt-3 text-gray-600">
          {isProvider
            ? "Your account is activated. Next, let's set up your provider profile so customers can find you."
            : "Your account is fully activated. You're all set to book and message service providers."}
        </p>
        <div className="mt-8 flex flex-wrap items-center gap-3">
          <Button onClick={() => router.push(primaryHref)}>
            {primaryLabel}
          </Button>
          {!isProvider && (
            <Button variant="outline" asChild>
              <Link href="/search">Browse providers</Link>
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-md">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary-50">
        <MailCheck className="h-8 w-8 text-primary-600" />
      </div>
      <h1 className="mt-6 font-sans text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">
        Enter your <span className="italic text-primary-600">code.</span>
      </h1>
      <p className="mt-3 text-gray-600">
        We sent a 6-digit code to{" "}
        <span className="font-bold text-gray-900">{user.email}</span>. Enter it
        below to verify your email. The code expires in 15 minutes.
      </p>

      {error && (
        <div
          role="alert"
          className="mt-6 flex items-start gap-2 rounded-xl border-2 border-red-100 bg-red-50 p-3 text-sm font-semibold text-red-700"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="mt-8 flex justify-between gap-2 sm:gap-3">
        {digits.map((d, i) => (
          <input
            key={i}
            ref={(el) => {
              inputsRef.current[i] = el;
            }}
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={CODE_LENGTH}
            value={d}
            onChange={(e) => handleChange(i, e.target.value)}
            onKeyDown={(e) => handleKeyDown(i, e)}
            onPaste={(e) => handlePaste(i, e)}
            aria-label={`Digit ${i + 1} of ${CODE_LENGTH}`}
            disabled={submitting}
            className={cn(
              "h-14 w-12 rounded-xl border-2 text-center font-mono text-2xl font-bold text-gray-900 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 sm:h-16 sm:w-14",
              d
                ? "border-primary-500 bg-primary-50"
                : "border-gray-200 bg-white",
              error && "border-red-300 bg-red-50",
            )}
          />
        ))}
      </div>

      <Button
        type="button"
        size="lg"
        className="mt-6 w-full"
        disabled={!isComplete}
        isLoading={submitting}
        onClick={submit}
      >
        Verify email
      </Button>

      <div className="mt-6 text-center text-sm text-gray-600">
        {sendStatus === "sending" ? (
          <span className="inline-flex items-center gap-1.5 font-semibold text-gray-500">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Sending code…
          </span>
        ) : resendCooldown > 0 ? (
          <span className="text-gray-500">
            Didn&apos;t get it? You can request a new code in {resendCooldown}s
          </span>
        ) : (
          <>
            Didn&apos;t get it?{" "}
            <button
              type="button"
              onClick={() => resend(false)}
              className="inline-flex items-center gap-1 font-bold text-primary-600 underline-offset-4 hover:underline"
            >
              <RotateCw className="h-3.5 w-3.5" />
              Resend code
            </button>
          </>
        )}
      </div>

      <p className="mt-8 text-center text-xs text-gray-500">
        Wrong email?{" "}
        <Link
          href="/profile"
          className="font-semibold text-primary-600 underline-offset-4 hover:underline"
        >
          Update it in your profile
        </Link>
        .
      </p>
    </div>
  );
}
