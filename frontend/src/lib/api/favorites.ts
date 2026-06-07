import { apiClient } from "./client";
import type { Provider } from "@/types";

export interface FavoriteListItem {
  favoritedAt: string;
  provider: Provider;
}

export const favoritesService = {
  async list(): Promise<FavoriteListItem[]> {
    return apiClient.get<FavoriteListItem[]>("/favorites", true);
  },

  async add(providerId: string): Promise<void> {
    await apiClient.post(`/favorites/${providerId}`, undefined, true);
  },

  async remove(providerId: string): Promise<void> {
    await apiClient.delete(`/favorites/${providerId}`, true);
  },

  /**
   * Bulk check which provider ids the current user has saved. Used to seed
   * the heart-button state on /search and the homepage without N round-trips.
   */
  async check(providerIds: string[]): Promise<string[]> {
    if (providerIds.length === 0) return [];
    const res = await apiClient.post<{ favoritedProviderIds: string[] }>(
      "/favorites/check",
      { providerIds },
      true,
    );
    return res.favoritedProviderIds;
  },
};
