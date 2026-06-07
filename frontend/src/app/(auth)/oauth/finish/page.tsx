"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AlertCircle,
  ArrowRight,
  Check,
  Loader2,
  Search as SearchIcon,
  Wrench,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { authService } from "@/lib/api";
import { useAuthStore } from "@/store/auth-store";
import { cn } from "@/lib/utils";

type Role = "CUSTOMER" | "PROVIDER";

export default function OAuthFinishPage() {
  return (
    <Suspense fallback={<Loader2 className="h-8 w-8 animate-spin" />}>
      <OAuthFinish />
    </Suspense>
  );
}

function OAuthFinish() {
  const router = useRouter();
  const params = useSearchParams();
  const signup = params.get("signup");
  const email = params.get("email");
  const name = params.get("name");
  const returnUrl = params.get("returnUrl");
  const fetchUser = useAuthStore((s) => s.fetchUser);

  const [role, setRole] = useState<Role | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!signup) {
    return (
      <div className="mx-auto w-full max-w-md">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-red-50">
          <AlertCircle className="h-8 w-8 text-red-600" />
        </div>
        <h1 className="mt-6 font-sans text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">
          Signup session missing.
        </h1>
        <p className="mt-3 text-gray-600">
          We lost track of your sign-up. Try Continue with Google again.
        </p>
        <Button asChild className="mt-8">
          <Link href="/login">Back to login</Link>
        </Button>
      </div>
    );
  }

  const submit = async () => {
    if (!role) return;
    setSubmitting(true);
    setError(null);
    try {
      await authService.googleComplete(signup, role);
      await fetchUser();
      router.replace(
        returnUrl || (role === "PROVIDER" ? "/onboarding" : "/dashboard"),
      );
    } catch (err) {
      setSubmitting(false);
      setError(
        err instanceof Error
          ? err.message
          : "We couldn't finish your sign-up. Try again.",
      );
    }
  };

  return (
    <div className="mx-auto w-full max-w-xl">
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary-600">
        Almost there
      </p>
      <h1 className="mt-2 font-sans text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">
        Finish setting up{" "}
        <span className="italic text-primary-600">your account.</span>
      </h1>
      <p className="mt-3 text-gray-600">
        {name ? <>Welcome, <strong>{name}</strong>! </> : null}
        We just need to know how you&apos;ll be using Local Service Finder.
        {email && (
          <>
            {" "}You&apos;re signing in with{" "}
            <span className="font-bold text-gray-900">{email}</span>.
          </>
        )}
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
          active={role === "CUSTOMER"}
          onClick={() => setRole("CUSTOMER")}
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
          active={role === "PROVIDER"}
          onClick={() => setRole("PROVIDER")}
        />

        <Button
          size="lg"
          className="mt-2 w-full"
          disabled={!role}
          isLoading={submitting}
          onClick={submit}
        >
          Continue
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
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
