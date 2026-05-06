import { apiClient, buildQueryString } from "./client";
import type { Provider, PaginatedResponse } from "@/types";

export const adminService = {
  async getPendingVerifications(params?: {
    page?: number;
    limit?: number;
    search?: string;
  }): Promise<PaginatedResponse<Provider> | { items: Provider[]; total: number }> {
    const qs = buildQueryString(params || {});
    return apiClient.get(`/admin/providers/pending${qs}`, true);
  },

  async verifyProvider(id: string): Promise<Provider> {
    return apiClient.post(`/admin/providers/${id}/verify`, {}, true);
  },

  async rejectProvider(id: string, reason: string): Promise<Provider> {
    return apiClient.post(`/admin/providers/${id}/reject`, { reason }, true);
  },
};
