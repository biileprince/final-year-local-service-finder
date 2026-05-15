"use client";

import { authService } from "@/lib/api";
import { cn } from "@/lib/utils";

interface Props {
  role?: "CUSTOMER" | "PROVIDER";
  returnUrl?: string;
  label?: string;
  className?: string;
}

/**
 * Full-bleed "Continue with Google" button. Hitting it does a top-level
 * navigation to the backend OAuth entry point — Google then handles the rest
 * and redirects back to /oauth/return (or /oauth/finish if the user is brand
 * new and never picked a role).
 */
export function ContinueWithGoogleButton({
  role,
  returnUrl,
  label = "Continue with Google",
  className,
}: Props) {
  return (
    <a
      href={authService.googleStartUrl({ role, returnUrl })}
      className={cn(
        "flex w-full items-center justify-center gap-3 rounded-xl border-2 border-gray-200 bg-white px-4 py-3 text-sm font-bold text-gray-700 shadow-sm transition-all hover:border-gray-300 hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2",
        className,
      )}
    >
      <GoogleLogo className="h-5 w-5" />
      {label}
    </a>
  );
}

function GoogleLogo({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 48 48" aria-hidden="true">
      <path
        fill="#FFC107"
        d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.1 8 3l5.7-5.7C34.5 6.1 29.5 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"
      />
      <path
        fill="#FF3D00"
        d="M6.3 14.7l6.6 4.8C14.6 16 19 13 24 13c3.1 0 5.9 1.1 8 3l5.7-5.7C34.5 6.1 29.5 4 24 4 16.3 4 9.7 8.4 6.3 14.7z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.4 0 10.3-2.1 14-5.4l-6.5-5.5c-2 1.4-4.7 2.4-7.5 2.4-5.3 0-9.7-3.3-11.3-8L6 32.6C9.4 39 16.1 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4-4 5.4l6.5 5.5c-.5.5 7.2-5.3 7.2-14.9 0-1.3-.1-2.4-.4-3.5z"
      />
    </svg>
  );
}
