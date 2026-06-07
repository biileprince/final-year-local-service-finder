import type { ApiError } from "@/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

type RequestMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

const CSRF_COOKIE_NAME = "lsf_csrf_token";
const MUTATING_METHODS: ReadonlySet<RequestMethod> = new Set([
  "POST",
  "PUT",
  "PATCH",
  "DELETE",
]);

/**
 * Reads the double-submit CSRF cookie set by the backend on login/refresh.
 * The value is echoed in the `x-csrf-token` header on mutating requests; the
 * backend's CsrfGuard validates the two match when CSRF_ENABLED is on.
 */
function readCsrfCookie(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(
    new RegExp(`(?:^|;\\s*)${CSRF_COOKIE_NAME}=([^;]+)`),
  );
  return match?.[1] ? decodeURIComponent(match[1]) : null;
}

interface RequestOptions {
  method?: RequestMethod;
  body?: any;
  headers?: Record<string, string>;
  cache?: RequestCache;
  next?: NextFetchRequestConfig;
  signal?: AbortSignal;
}

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  private getToken(): string | null {
    if (typeof window === "undefined") return null;
    return localStorage.getItem("accessToken");
  }

  private getRefreshToken(): string | null {
    if (typeof window === "undefined") return null;
    return localStorage.getItem("refreshToken");
  }

  setTokens(accessToken: string, refreshToken: string): void {
    if (typeof window === "undefined") return;
    localStorage.setItem("accessToken", accessToken);
    localStorage.setItem("refreshToken", refreshToken);
  }

  clearTokens(): void {
    if (typeof window === "undefined") return;
    localStorage.removeItem("accessToken");
    localStorage.removeItem("refreshToken");
    // Also wipe the persisted Zustand auth-storage so isAuthenticated/user
    // don't survive a token-only clear. Leaving them behind makes
    // useRedirectIfAuthenticated on /login bounce the user back to /dashboard
    // and create a redirect loop after the session expires.
    localStorage.removeItem("auth-storage");
  }

  /**
   * Coalesces concurrent refresh attempts so a single 401 burst (many parallel
   * requests after the access token expires) results in ONE refresh call.
   */
  private refreshPromise: Promise<boolean> | null = null;

  private async refreshTokens(): Promise<boolean> {
    if (this.refreshPromise) return this.refreshPromise;

    this.refreshPromise = (async () => {
      const refreshToken = this.getRefreshToken();
      if (!refreshToken) return false;

      try {
        const response = await fetch(`${this.baseUrl}/auth/refresh`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refreshToken }),
        });

        if (!response.ok) {
          this.clearTokens();
          return false;
        }

        const data = await response.json();
        this.setTokens(data.accessToken, data.refreshToken);
        return true;
      } catch {
        this.clearTokens();
        return false;
      } finally {
        // Allow the next 401 (well after this refresh) to try again.
        setTimeout(() => {
          this.refreshPromise = null;
        }, 0);
      }
    })();

    return this.refreshPromise;
  }

  /**
   * Called when both the access token request and a refresh attempt have
   * failed. Clears storage and bounces the user to /login with a returnUrl so
   * they land back where they were after logging in. We use window.location
   * (not next/router) because this runs outside any React render and we want a
   * hard reload — that also resets any in-memory zustand state that might be
   * holding stale auth flags.
   */
  private handleAuthFailure(): void {
    if (typeof window === "undefined") return;
    this.clearTokens();
    const current = window.location.pathname + window.location.search;
    // Avoid redirect loop if we're already on an auth page.
    if (/^\/(login|register|forgot-password|reset-password|verify-email)/.test(window.location.pathname)) {
      return;
    }
    const returnUrl = encodeURIComponent(current);
    window.location.href = `/login?returnUrl=${returnUrl}&reason=session-expired`;
  }

  async request<T>(
    endpoint: string,
    options: RequestOptions = {},
    requiresAuth = false
  ): Promise<T> {
    const { method = "GET", body, headers = {}, cache, next, signal } = options;

    const requestHeaders: Record<string, string> = {
      "Content-Type": "application/json",
      ...headers,
    };

    if (requiresAuth) {
      const token = this.getToken();
      if (token) {
        requestHeaders["Authorization"] = `Bearer ${token}`;
      }
    }

    // Echo the double-submit CSRF token on mutating requests so the backend
    // CsrfGuard can validate it when CSRF_ENABLED is on. No-op when the cookie
    // isn't present (e.g., before login, in tests).
    if (MUTATING_METHODS.has(method)) {
      const csrfToken = readCsrfCookie();
      if (csrfToken) {
        requestHeaders["x-csrf-token"] = csrfToken;
      }
    }

    const fetchOptions: RequestInit = {
      method,
      headers: requestHeaders,
      cache,
      next,
      signal,
      credentials: "include",
    };

    if (body && method !== "GET") {
      fetchOptions.body = JSON.stringify(body);
    }

    let response = await fetch(`${this.baseUrl}${endpoint}`, fetchOptions);

    // Handle token refresh on 401
    if (response.status === 401 && requiresAuth) {
      const refreshed = await this.refreshTokens();
      if (refreshed) {
        const newToken = this.getToken();
        if (newToken) {
          requestHeaders["Authorization"] = `Bearer ${newToken}`;
        }
        response = await fetch(`${this.baseUrl}${endpoint}`, {
          ...fetchOptions,
          headers: requestHeaders,
        });
        // If the retry is also unauthorized, the session is truly gone.
        if (response.status === 401) {
          this.handleAuthFailure();
        }
      } else {
        this.handleAuthFailure();
      }
    }

    if (!response.ok) {
      const error: ApiError = await response.json().catch(() => ({
        message: "An error occurred",
        statusCode: response.status,
      }));
      throw new Error(error.message || "Request failed");
    }

    // Handle empty responses
    const text = await response.text();
    if (!text) return {} as T;
    return JSON.parse(text);
  }

  async get<T>(endpoint: string, requiresAuth = false, options?: Omit<RequestOptions, "method" | "body">): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: "GET" }, requiresAuth);
  }

  async post<T>(endpoint: string, body?: any, requiresAuth = false): Promise<T> {
    return this.request<T>(endpoint, { method: "POST", body }, requiresAuth);
  }

  async put<T>(endpoint: string, body?: any, requiresAuth = false): Promise<T> {
    return this.request<T>(endpoint, { method: "PUT", body }, requiresAuth);
  }

  async patch<T>(endpoint: string, body?: any, requiresAuth = false): Promise<T> {
    return this.request<T>(endpoint, { method: "PATCH", body }, requiresAuth);
  }

  async delete<T>(endpoint: string, requiresAuth = false): Promise<T> {
    return this.request<T>(endpoint, { method: "DELETE" }, requiresAuth);
  }

  async uploadFile(endpoint: string, file: File, context?: string): Promise<any> {
    const sendOnce = async (token: string | null) => {
      const formData = new FormData();
      formData.append("file", file);
      if (context) formData.append("context", context);
      const headers: Record<string, string> = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;
      const csrfToken = readCsrfCookie();
      if (csrfToken) headers["x-csrf-token"] = csrfToken;
      return fetch(`${this.baseUrl}${endpoint}`, {
        method: "POST",
        headers,
        body: formData,
        credentials: "include",
      });
    };

    let token = this.getToken();
    let response = await sendOnce(token);

    if (response.status === 401) {
      const refreshed = await this.refreshTokens();
      if (refreshed) {
        token = this.getToken();
        response = await sendOnce(token);
        if (response.status === 401) {
          this.handleAuthFailure();
        }
      } else {
        this.handleAuthFailure();
      }
    }

    if (!response.ok) {
      const error = await response.json().catch(() => ({
        message: "File upload failed",
      }));
      throw new Error(error.message || "File upload failed");
    }

    return response.json();
  }
}

// Create and export singleton instance
export const apiClient = new ApiClient(API_URL);

// Helper to build query string
export function buildQueryString(params: Record<string, any>): string {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      searchParams.append(key, String(value));
    }
  });
  const queryString = searchParams.toString();
  return queryString ? `?${queryString}` : "";
}
