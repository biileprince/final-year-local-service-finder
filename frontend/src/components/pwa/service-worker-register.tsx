"use client";

import { useEffect } from "react";

// Registers the offline-shell service worker once, after the page loads.
// Only runs in production builds — a SW in dev fights with HMR and caches stale
// chunks.
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

    const register = () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // Registration failures shouldn't break the app — offline is best-effort.
      });
    };

    if (document.readyState === "complete") {
      register();
    } else {
      window.addEventListener("load", register);
      return () => window.removeEventListener("load", register);
    }
  }, []);

  return null;
}
