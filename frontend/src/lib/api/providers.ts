import { apiClient, buildQueryString } from "./client";
import type { Provider, Review, PaginatedResponse, Availability } from "@/types";

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
    return apiClient.get<ProviderSearchResult>(`/providers${queryString}`);
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

  async updateProfile(data: Partial<{
    bio: string;
    hourlyRate: number;
    yearsExperience: number;
    location: string;
    latitude: number;
    longitude: number;
    serviceRadiusKm: number;
  }>): Promise<Provider> {
    return apiClient.patch<Provider>("/providers/me", data, true);
  },

  async getReviews(
    providerId: string,
    params?: { page?: number; limit?: number }
  ): Promise<PaginatedResponse<Review>> {
    const queryString = buildQueryString(params || {});
    return apiClient.get<PaginatedResponse<Review>>(`/providers/${providerId}/reviews${queryString}`);
  },

  async getAvailability(providerId: string, month: string): Promise<Availability[]> {
    return apiClient.get<Availability[]>(`/availability/provider/${providerId}?month=${month}`);
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
      limit
    });
    return result.providers;
  },
};
