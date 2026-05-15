import { apiClient } from "./client";
import type { User, LoginResponse, RegisterResponse } from "@/types";

export interface LoginDto {
  email: string;
  password: string;
}

export interface RegisterDto {
  email: string;
  password: string;
  name: string;
  phone?: string;
  role?: "CUSTOMER" | "PROVIDER";
}

export const authService = {
  async login(data: LoginDto): Promise<LoginResponse> {
    const response = await apiClient.post<LoginResponse>("/auth/login", data);
    if (response.accessToken) {
      apiClient.setTokens(response.accessToken, response.refreshToken);
    }
    return response;
  },

  async register(data: RegisterDto): Promise<RegisterResponse> {
    const response = await apiClient.post<RegisterResponse>(
      "/auth/register",
      data,
    );
    if (response.accessToken) {
      apiClient.setTokens(response.accessToken, response.refreshToken);
    }
    return response;
  },

  async logout(): Promise<void> {
    try {
      await apiClient.post("/auth/logout", {}, true);
    } finally {
      apiClient.clearTokens();
    }
  },

  async getCurrentUser(): Promise<User> {
    return apiClient.get<User>("/users/me", true);
  },

  async changePassword(data: {
    currentPassword: string;
    newPassword: string;
  }): Promise<void> {
    return apiClient.post("/auth/change-password", data, true);
  },

  async forgotPassword(email: string): Promise<void> {
    return apiClient.post("/auth/forgot-password", { email });
  },

  async resetPassword(token: string, password: string): Promise<void> {
    return apiClient.post("/auth/reset-password", { token, password });
  },

  async verifyEmail(code: string): Promise<void> {
    return apiClient.post("/auth/verify-email", { code }, true);
  },

  /** Build the URL to start the Google OAuth flow, with an optional role
   *  hint signed into state on the backend. */
  googleStartUrl(opts: {
    role?: "CUSTOMER" | "PROVIDER";
    returnUrl?: string;
  } = {}): string {
    const params = new URLSearchParams();
    if (opts.role) params.set("role", opts.role);
    if (opts.returnUrl) params.set("returnUrl", opts.returnUrl);
    const base = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
    const qs = params.toString();
    return qs ? `${base}/auth/google?${qs}` : `${base}/auth/google`;
  },

  async googleExchange(code: string): Promise<LoginResponse> {
    const response = await apiClient.post<LoginResponse>(
      "/auth/google/exchange",
      { code },
    );
    if (response.accessToken) {
      apiClient.setTokens(response.accessToken, response.refreshToken);
    }
    return response;
  },

  async googleComplete(
    signup: string,
    role: "CUSTOMER" | "PROVIDER",
  ): Promise<LoginResponse> {
    const response = await apiClient.post<LoginResponse>(
      "/auth/google/complete",
      { signup, role },
    );
    if (response.accessToken) {
      apiClient.setTokens(response.accessToken, response.refreshToken);
    }
    return response;
  },

  async sendVerification(): Promise<void> {
    return apiClient.post("/auth/send-verification", {}, true);
  },

  async sendOtp(phone: string): Promise<void> {
    return apiClient.post("/auth/send-otp", { phone }, true);
  },

  async verifyOtp(phone: string, code: string): Promise<void> {
    return apiClient.post("/auth/verify-otp", { phone, code }, true);
  },

  async updateUser(data: {
    name?: string;
    phone?: string;
    profileImage?: string;
  }): Promise<import("@/types").User> {
    return apiClient.put<import("@/types").User>("/users/me", data, true);
  },

  isAuthenticated(): boolean {
    if (typeof window === "undefined") return false;
    return !!localStorage.getItem("accessToken");
  },
};
