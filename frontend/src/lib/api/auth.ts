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

  async verifyEmail(token: string): Promise<void> {
    return apiClient.get(
      `/auth/verify-email?token=${encodeURIComponent(token)}`,
    );
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
  }): Promise<import("@/types").User> {
    return apiClient.patch<import("@/types").User>("/users/me", data, true);
  },

  isAuthenticated(): boolean {
    if (typeof window === "undefined") return false;
    return !!localStorage.getItem("accessToken");
  },
};
