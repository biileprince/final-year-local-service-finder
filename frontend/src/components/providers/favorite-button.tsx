"use client";

import { useState, useEffect, type MouseEvent } from "react";
import { useRouter } from "next/navigation";
import { Heart } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/store/auth-store";
import { useFavoritesStore } from "@/store/favorites-store";

interface FavoriteButtonProps {
  providerId: string;
  /** "icon" floats over a provider card; "inline" sits next to a title. */
  variant?: "icon" | "inline";
  className?: string;
  /**
   * When this button is inside another clickable element (eg a card that
   * links to /providers/[id]) we need to stop the click event so the heart
   * tap doesn't navigate.
   */
  stopPropagation?: boolean;
}

/**
 * Customer "save provider" heart. Optimistically toggles `useFavoritesStore`;
 * unauthenticated clicks redirect to /login with a returnUrl so the user lands
 * back where they were after signing in.
 */
export function FavoriteButton({
  providerId,
  variant = "icon",
  className,
  stopPropagation = true,
}: FavoriteButtonProps) {
  const router = useRouter();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isFavorite = useFavoritesStore((s) =>
    s.ids.has(providerId),
  );
  const toggle = useFavoritesStore((s) => s.toggle);
  const hydrate = useFavoritesStore((s) => s.hydrate);
  const hydrated = useFavoritesStore((s) => s.hydrated);
  const [busy, setBusy] = useState(false);

  // Lazy hydration — the first heart button mounted in an authed session
  // triggers the fetch; subsequent ones short-circuit on `hydrated`.
  useEffect(() => {
    if (isAuthenticated && !hydrated) {
      void hydrate();
    }
  }, [isAuthenticated, hydrated, hydrate]);

  const onClick = async (e: MouseEvent) => {
    if (stopPropagation) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (!isAuthenticated) {
      const returnUrl =
        typeof window !== "undefined"
          ? window.location.pathname + window.location.search
          : "/";
      router.push(`/login?returnUrl=${encodeURIComponent(returnUrl)}`);
      return;
    }
    if (busy) return;
    setBusy(true);
    try {
      await toggle(providerId);
    } finally {
      setBusy(false);
    }
  };

  const label = isFavorite ? "Remove from favorites" : "Save to favorites";

  if (variant === "inline") {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-label={label}
        aria-pressed={isFavorite}
        disabled={busy}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full border-2 px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-60",
          isFavorite
            ? "border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100"
            : "border-gray-200 bg-white text-gray-700 hover:border-rose-300 hover:text-rose-700",
          className,
        )}
      >
        <Heart
          className={cn(
            "h-3.5 w-3.5",
            isFavorite && "fill-rose-500 text-rose-500",
          )}
        />
        {isFavorite ? "Saved" : "Save"}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={isFavorite}
      disabled={busy}
      className={cn(
        "inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/95 shadow-md ring-1 ring-black/5 backdrop-blur transition-transform hover:scale-110 disabled:opacity-60",
        className,
      )}
    >
      <Heart
        className={cn(
          "h-4 w-4 transition-colors",
          isFavorite ? "fill-rose-500 text-rose-500" : "text-gray-700",
        )}
      />
    </button>
  );
}
