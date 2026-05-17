import { apiClient, buildQueryString } from "./client";
import type { Provider, User, Booking, Review, Category } from "@/types";

export interface AdminPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface DashboardStats {
  users: {
    total: number;
    customers: number;
    providers: number;
    admins: number;
    newThisMonth: number;
  };
  providers: {
    total: number;
    verified: number;
    pending: number;
    rejected: number;
    activeCount: number;
  };
  bookings: {
    total: number;
    pending: number;
    confirmed: number;
    completed: number;
    cancelled: number;
    thisMonth: number;
    revenue: number;
  };
  reviews: {
    total: number;
    averageRating: number;
    reported: number;
  };
}

export type RevenuePoint = { date: string; revenue: number };

export interface AdminUser extends User {
  lastLoginAt?: string;
  loginCount?: number;
  emailVerifiedAt?: string;
  /** Set when the user has been suspended (soft-deleted). */
  deletedAt?: string | null;
  provider?: { id: string; verificationStatus: string; rating: number } | null;
}

export interface AuditLogEntry {
  id: string;
  tableName: string;
  recordId: string;
  action: string;
  oldValues?: Record<string, unknown> | null;
  newValues?: Record<string, unknown> | null;
  changedFields: string[];
  userId?: string | null;
  ipAddress?: string | null;
  createdAt: string;
  user?: { id: string; name: string; email: string } | null;
}

export const adminService = {
  // Dashboard / metrics
  async getDashboard(): Promise<DashboardStats> {
    return apiClient.get("/admin/dashboard", true);
  },

  async getRevenue(days = 30): Promise<RevenuePoint[]> {
    return apiClient.get(`/admin/analytics/revenue?days=${days}`, true);
  },

  async getSystemHealth(): Promise<{
    database: { connected: boolean };
    errors: { last24Hours: number };
    users: { activeLast24Hours: number };
    uptime: number;
  }> {
    return apiClient.get("/admin/system/health", true);
  },

  // Provider verification queue
  async getPendingVerifications(params?: {
    page?: number;
    limit?: number;
    search?: string;
  }): Promise<
    | { providers: Provider[]; pagination: AdminPagination }
    | { items: Provider[]; total: number }
  > {
    const qs = buildQueryString(params || {});
    return apiClient.get(`/admin/providers/pending${qs}`, true);
  },

  async verifyProvider(id: string): Promise<Provider> {
    return apiClient.post(`/admin/providers/${id}/verify`, {}, true);
  },

  async rejectProvider(id: string, reason: string): Promise<Provider> {
    return apiClient.post(`/admin/providers/${id}/reject`, { reason }, true);
  },

  // Users
  async getUsers(params?: {
    page?: number;
    limit?: number;
    role?: "CUSTOMER" | "PROVIDER" | "ADMIN";
    search?: string;
  }): Promise<{ users: AdminUser[]; pagination: AdminPagination }> {
    const qs = buildQueryString(params || {});
    return apiClient.get(`/admin/users${qs}`, true);
  },

  async suspendUser(id: string, reason: string): Promise<AdminUser> {
    return apiClient.post(`/admin/users/${id}/suspend`, { reason }, true);
  },

  async reactivateUser(id: string): Promise<AdminUser> {
    return apiClient.post(`/admin/users/${id}/reactivate`, {}, true);
  },

  async updateUserRole(
    id: string,
    role: "CUSTOMER" | "PROVIDER" | "ADMIN",
  ): Promise<AdminUser> {
    return apiClient.put(`/admin/users/${id}/role`, { role }, true);
  },

  // Bookings
  async getBookings(params?: {
    page?: number;
    limit?: number;
    status?: string;
    providerId?: string;
    customerId?: string;
  }): Promise<{ bookings: Booking[]; pagination: AdminPagination }> {
    const qs = buildQueryString(params || {});
    return apiClient.get(`/admin/bookings${qs}`, true);
  },

  async cancelBooking(id: string, reason: string): Promise<Booking> {
    return apiClient.post(`/admin/bookings/${id}/cancel`, { reason }, true);
  },

  // Reviews moderation
  async getReportedReviews(params?: {
    page?: number;
    limit?: number;
  }): Promise<{ reviews: Review[]; pagination: AdminPagination }> {
    const qs = buildQueryString(params || {});
    return apiClient.get(`/admin/reviews/reported${qs}`, true);
  },

  async moderateReview(
    id: string,
    action: "approve" | "hide" | "delete",
  ): Promise<Review> {
    return apiClient.post(`/admin/reviews/${id}/moderate`, { action }, true);
  },

  // Categories
  async createCategory(data: {
    name: string;
    slug: string;
    description?: string;
    icon?: string;
    color?: string;
    imageId?: string | null;
    displayOrder?: number;
  }): Promise<Category> {
    return apiClient.post("/admin/categories", data, true);
  },

  async updateCategory(
    id: string,
    data: Partial<{
      name: string;
      slug: string;
      description: string;
      icon: string;
      color: string;
      imageId: string | null;
      displayOrder: number;
      isActive: boolean;
    }>,
  ): Promise<Category> {
    return apiClient.put(`/admin/categories/${id}`, data, true);
  },

  async deleteCategory(id: string): Promise<void> {
    return apiClient.delete(`/admin/categories/${id}`, true);
  },

  // Audit logs
  async getAuditLogs(params?: {
    page?: number;
    limit?: number;
  }): Promise<{ logs: AuditLogEntry[]; pagination: AdminPagination }> {
    const qs = buildQueryString(params || {});
    return apiClient.get(`/admin/system/audit-logs${qs}`, true);
  },
};
