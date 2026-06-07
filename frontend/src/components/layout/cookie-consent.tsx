"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Cookie, X } from "lucide-react";

const STORAGE_KEY = "lsf:cookie-consent";

type Choice = "accepted" | "essential";

export function CookieConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (!stored) setVisible(true);
    } catch {
      // localStorage blocked (private browsing etc.) — show the banner but
      // don't crash. The accept handler will silently no-op on persist.
      setVisible(true);
    }
  }, []);

  const dismiss = (choice: Choice) => {
    try {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ choice, at: new Date().toISOString() })
      );
    } catch {
      // ignore
    }
    // Let consent-aware listeners (e.g. PostHogProvider) react without a reload.
    try {
      window.dispatchEvent(new CustomEvent("lsf:consent", { detail: choice }));
    } catch {
      // ignore
    }
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-live="polite"
      aria-label="Cookie consent"
      className="fixed inset-x-3 bottom-3 z-50 sm:inset-x-auto sm:left-4 sm:right-4 sm:bottom-4 md:left-auto md:right-6 md:bottom-6 md:max-w-md"
    >
      <div className="overflow-hidden rounded-2xl border border-secondary-200 bg-white shadow-2xl">
        <div className="flex items-start gap-3 p-4 sm:p-5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-50 text-primary-600">
            <Cookie className="h-5 w-5" aria-hidden="true" />
          </div>
          <div className="flex-1 text-sm leading-relaxed text-secondary-700">
            <p className="font-bold text-secondary-900">We use cookies</p>
            <p className="mt-1">
              We use strictly-necessary cookies to keep you signed in and a
              few functional ones to remember preferences. See our{" "}
              <Link
                href="/cookies"
                className="font-semibold text-primary-600 hover:underline"
              >
                Cookie Policy
              </Link>{" "}
              and{" "}
              <Link
                href="/privacy"
                className="font-semibold text-primary-600 hover:underline"
              >
                Privacy Policy
              </Link>
              .
            </p>
          </div>
          <button
            type="button"
            onClick={() => dismiss("essential")}
            aria-label="Dismiss cookie banner"
            className="shrink-0 rounded-lg p-1 text-secondary-400 transition-colors hover:bg-secondary-100 hover:text-secondary-700"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
        <div className="flex flex-col gap-2 border-t border-secondary-200 bg-secondary-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-end sm:px-5">
          <button
            type="button"
            onClick={() => dismiss("essential")}
            className="rounded-lg px-4 py-2 text-sm font-bold text-secondary-700 transition-colors hover:bg-secondary-100"
          >
            Essential only
          </button>
          <button
            type="button"
            onClick={() => dismiss("accepted")}
            className="rounded-lg bg-primary-500 px-4 py-2 text-sm font-bold text-white shadow-md transition-colors hover:bg-primary-600"
          >
            Accept all
          </button>
        </div>
      </div>
    </div>
  );
}
