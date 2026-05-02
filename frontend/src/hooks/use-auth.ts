"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuthStore } from "@/store/auth-store";

export function useAuth() {
  const store = useAuthStore();

  return {
    user: store.user,
    isLoading: store.isLoading,
    isAuthenticated: store.isAuthenticated,
    error: store.error,
    login: store.login,
    register: store.register,
    logout: store.logout,
    clearError: store.clearError,
  };
}

export function useRequireAuth(redirectTo = "/login") {
  const router = useRouter();
  const pathname = usePathname();
  const { user, isAuthenticated, isLoading, fetchUser } = useAuthStore();

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      const returnUrl = encodeURIComponent(pathname);
      router.push(`${redirectTo}?returnUrl=${returnUrl}`);
    }
  }, [isLoading, isAuthenticated, router, redirectTo, pathname]);

  return {
    user,
    isLoading,
    isAuthenticated,
  };
}

export function useRequireRole(
  allowedRoles: ("CUSTOMER" | "PROVIDER" | "ADMIN")[],
  redirectTo = "/"
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
  const { isAuthenticated, isLoading, fetchUser } = useAuthStore();

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.push(redirectTo);
    }
  }, [isLoading, isAuthenticated, router, redirectTo]);

  return { isLoading };
}
