import { apiClient } from "./client";

export const usersService = {
  /** GDPR export — full machine-readable copy of the account's data. */
  async exportData(): Promise<Record<string, unknown>> {
    return apiClient.get<Record<string, unknown>>("/users/me/export", true);
  },

  /** Permanently deletes the current account and revokes all sessions. */
  async deleteAccount(): Promise<{ message: string }> {
    return apiClient.delete<{ message: string }>("/users/me", true);
  },
};
