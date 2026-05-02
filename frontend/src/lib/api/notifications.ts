import { apiClient, buildQueryString } from "./client";
import type { Notification } from "@/types";

export const notificationsService = {
  async getAll(params?: {
    unreadOnly?: boolean;
    limit?: number;
    before?: string;
  }): Promise<Notification[]> {
    const queryString = buildQueryString(params || {});
    return apiClient.get<Notification[]>(`/notifications${queryString}`, true);
  },

  async getUnreadCount(): Promise<{ unreadCount: number }> {
    return apiClient.get("/notifications/unread-count", true);
  },

  async markAsRead(id: string): Promise<void> {
    return apiClient.put(`/notifications/${id}/read`, {}, true);
  },

  async markAllAsRead(): Promise<void> {
    return apiClient.put("/notifications/read-all", {}, true);
  },

  async delete(id: string): Promise<void> {
    return apiClient.delete(`/notifications/${id}`, true);
  },

  async getPreferences(): Promise<any> {
    return apiClient.get("/notifications/preferences", true);
  },

  async updatePreferences(preferences: any): Promise<any> {
    return apiClient.put("/notifications/preferences", preferences, true);
  },
};
