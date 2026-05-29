"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import posthog from "posthog-js";

const CONSENT_KEY = "lsf:cookie-consent";
const KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const HOST =
  process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com";

let initialized = false;

function hasAnalyticsConsent(): boolean {
  try {
    const raw = window.localStorage.getItem(CONSENT_KEY);
    if (!raw) return false;
    return JSON.parse(raw)?.choice === "accepted";
  } catch {
    return false;
  }
}

function ensureInitialized(): boolean {
  if (initialized) return true;
  if (!KEY || !hasAnalyticsConsent()) return false;
  posthog.init(KEY, {
    api_host: HOST,
    capture_pageview: false, // captured manually on route change (App Router)
    persistence: "localStorage+cookie",
    autocapture: true,
  });
  initialized = true;
  return true;
}

/**
 * Initializes PostHog only after the user has accepted analytics cookies, and
 * captures a $pageview on every client-side route change. Listens for the
 * `lsf:consent` event so accepting the banner turns analytics on without a
 * reload.
 */
export function PostHogProvider() {
  const pathname = usePathname();

  // React to consent being granted after first paint.
  useEffect(() => {
    const onConsent = (e: Event) => {
      const choice = (e as CustomEvent<string>).detail;
      if (choice === "accepted" && ensureInitialized()) {
        posthog.capture("$pageview");
      }
    };
    window.addEventListener("lsf:consent", onConsent);
    return () => window.removeEventListener("lsf:consent", onConsent);
  }, []);

  // Page views on navigation (and the initial load if consent already given).
  useEffect(() => {
    if (!ensureInitialized()) return;
    posthog.capture("$pageview", { $current_url: window.location.href });
  }, [pathname]);

  return null;
}
