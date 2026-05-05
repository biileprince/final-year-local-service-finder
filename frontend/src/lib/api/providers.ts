import { apiClient, buildQueryString } from "./client";
import type {
  Provider,
  Review,
  PaginatedResponse,
  Availability,
} from "@/types";

export interface SearchProvidersParams {
  categoryId?: string;
  search?: string;
  minRating?: number;
  maxPrice?: number;
  verified?: boolean;
  featured?: boolean;
  lat?: number;
  lng?: number;
  radius?: number;
  sortBy?: "rating" | "price" | "distance" | "reviews";
  sortOrder?: "asc" | "desc";
  page?: number;
  limit?: number;
}

export interface ProviderSearchResult {
  providers: Provider[];
  total: number;
  page: number;
  totalPages: number;
}

export const providersService = {
  async search(params?: SearchProvidersParams): Promise<ProviderSearchResult> {
    const queryString = buildQueryString(params || {});
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result: any = await apiClient.get(`/providers${queryString}`);

    if (Array.isArray(result)) {
      return {
        providers: result as Provider[],
        total: result.length,
        page: 1,
        totalPages: 1,
      };
    }

    if (Array.isArray(result?.providers)) {
      return result as ProviderSearchResult;
    }

    if (Array.isArray(result?.items)) {
      const items: Provider[] = result.items;
      const total: number = result.total ?? items.length;
      const page: number = result.page ?? 1;
      const limit: number = result.limit ?? (items.length || 1);
      const totalPages: number =
        result.totalPages ?? Math.max(1, Math.ceil(total / limit));
      return { providers: items, total, page, totalPages };
    }

    return { providers: [], total: 0, page: 1, totalPages: 1 };
  },

  async getById(id: string): Promise<Provider> {
    return apiClient.get<Provider>(`/providers/${id}`);
  },

  async getBySlug(slug: string): Promise<Provider> {
    return apiClient.get<Provider>(`/providers/slug/${slug}`);
  },

  async getMyProfile(): Promise<Provider> {
    return apiClient.get<Provider>("/providers/me", true);
  },

  async updateProfile(
    data: Partial<{
      bio: string;
      hourlyRate: number;
      yearsExperience: number;
      location: string;
      latitude: number;
      longitude: number;
      serviceRadiusKm: number;
    }>,
  ): Promise<Provider> {
    return apiClient.put<Provider>("/providers/me", data, true);
  },

  async getReviews(
    providerId: string,
    params?: { page?: number; limit?: number },
  ): Promise<PaginatedResponse<Review>> {
    const queryString = buildQueryString(params || {});
    return apiClient.get<PaginatedResponse<Review>>(
      `/providers/${providerId}/reviews${queryString}`,
    );
  },

  async getAvailability(
    providerId: string,
    month: string,
  ): Promise<Availability[]> {
    return apiClient.get<Availability[]>(
      `/availability/provider/${providerId}?month=${month}`,
    );
  },

  async getFeatured(limit = 6): Promise<Provider[]> {
    const result = await this.search({ featured: true, verified: true, limit });
    return result.providers;
  },

  async getTopRated(limit = 6): Promise<Provider[]> {
    const result = await this.search({
      verified: true,
      sortBy: "rating",
      sortOrder: "desc",
      limit,
    });
    return result.providers;
  },

  async setCategories(categoryIds: string[]): Promise<Provider> {
    const me = await this.getMyProfile();
    return apiClient.put<Provider>(
      `/providers/${me.id}/categories`,
      { categoryIds },
      true,
    );
  },

  async setSpecialties(specialties: string[]): Promise<Provider> {
    const me = await this.getMyProfile();
    return apiClient.put<Provider>(
      `/providers/${me.id}/specialties`,
      { specialties },
      true,
    );
  },

  async getStats(providerId: string): Promise<Record<string, number>> {
    return apiClient.get(`/bookings/stats/${providerId}`, true);
  },
};
