import type { ApiError } from "@/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

type RequestMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

interface RequestOptions {
  method?: RequestMethod;
  body?: any;
  headers?: Record<string, string>;
  cache?: RequestCache;
  next?: NextFetchRequestConfig;
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
  }

  private async refreshTokens(): Promise<boolean> {
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
    }
  }

  async request<T>(
    endpoint: string,
    options: RequestOptions = {},
    requiresAuth = false
  ): Promise<T> {
    const { method = "GET", body, headers = {}, cache, next } = options;

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

    const fetchOptions: RequestInit = {
      method,
      headers: requestHeaders,
      cache,
      next,
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
    const formData = new FormData();
    formData.append("file", file);
    if (context) formData.append("context", context);

    const token = this.getToken();
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    });

    if (!response.ok) {
      throw new Error("File upload failed");
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
