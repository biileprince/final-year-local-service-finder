"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuthStore } from "@/store/auth-store";
import { authService } from "@/lib/api";

// Each hook below subscribes to only the slice of state it actually reads,
// so a change to (e.g.) `isLoading` won't re-render components that only need
// `user`. This is the recommended Zustand pattern.

export function useAuth() {
  const user = useAuthStore((s) => s.user);
  const isLoading = useAuthStore((s) => s.isLoading);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const error = useAuthStore((s) => s.error);
  const login = useAuthStore((s) => s.login);
  const register = useAuthStore((s) => s.register);
  const logout = useAuthStore((s) => s.logout);
  const setUser = useAuthStore((s) => s.setUser);
  const clearError = useAuthStore((s) => s.clearError);

  return {
    user,
    isLoading,
    isAuthenticated,
    error,
    login,
    register,
    logout,
    setUser,
    clearError,
  };
}

export function useRequireAuth(redirectTo = "/login") {
  const router = useRouter();
  const pathname = usePathname();

  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isLoading = useAuthStore((s) => s.isLoading);
  const fetchUser = useAuthStore((s) => s.fetchUser);

  // Both start false so server HTML matches the initial client render,
  // eliminating hydration mismatches.
  const [mounted, setMounted] = useState(false);
  const [hasHydrated, setHasHydrated] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Track when Zustand persist has finished reading from localStorage.
  // Prevents the race where mounted fires before hydration causes fetchUser
  // to run against a stale isAuthenticated=false snapshot.
  useEffect(() => {
    if (useAuthStore.persist.hasHydrated()) {
      setHasHydrated(true);
      return;
    }
    return useAuthStore.persist.onFinishHydration(() => setHasHydrated(true));
  }, []);

  // Only call fetchUser AFTER both mount and Zustand hydration are complete.
  // Trigger when a token exists but the store isn't fully authenticated:
  //   - !isAuthenticated → orphaned token / store still hydrating
  //   - !user → stale persist where user is missing
  useEffect(() => {
    if (!mounted || !hasHydrated) return;
    if (!authService.isAuthenticated()) return;
    if (!isAuthenticated || !user) {
      fetchUser();
    }
  }, [mounted, hasHydrated, isAuthenticated, user, fetchUser]);

  // Only redirect after mount and hydration so we never redirect before the
  // persisted auth state has been restored.
  useEffect(() => {
    if (!mounted || !hasHydrated) return;
    if (isLoading) return;
    if (isAuthenticated && user) return;
    if (authService.isAuthenticated()) return; // token present — fetchUser in flight
    const returnUrl = encodeURIComponent(pathname);
    router.push(`${redirectTo}?returnUrl=${returnUrl}`);
  }, [
    mounted,
    hasHydrated,
    isLoading,
    isAuthenticated,
    user,
    router,
    redirectTo,
    pathname,
  ]);

  // Loading while:
  //  - not mounted (SSR/hydration safety)
  //  - Zustand persist not yet hydrated
  //  - store-level fetchUser in flight
  //  - token present but auth not yet fully confirmed (user or flag missing)
  const loading =
    !mounted ||
    !hasHydrated ||
    isLoading ||
    ((!isAuthenticated || !user) && authService.isAuthenticated());

  return { user, isLoading: loading, isAuthenticated };
}

export function useRequireRole(
  allowedRoles: ("CUSTOMER" | "PROVIDER" | "ADMIN")[],
  redirectTo = "/",
) {
  const router = useRouter();
  const { user, isLoading, isAuthenticated } = useRequireAuth();

  useEffect(() => {
    if (!isLoading && isAuthenticated && user) {
      if (!allowedRoles.includes(user.role)) {
        router.push(redirectTo);
      }
    }
  }, [isLoading, isAuthenticated, user, allowedRoles, router, redirectTo]);

  return {
    user,
    isLoading,
    hasRole: user ? allowedRoles.includes(user.role) : false,
  };
}

export function useRedirectIfAuthenticated(redirectTo = "/dashboard") {
  const router = useRouter();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  useEffect(() => {
    if (isAuthenticated) {
      router.push(redirectTo);
    }
  }, [isAuthenticated, router, redirectTo]);
}
