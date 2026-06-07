import { apiClient, buildQueryString } from "./client";
import type { Review, PaginatedResponse } from "@/types";

export interface CreateReviewDto {
  providerId: string;
  bookingId?: string;
  rating: number;
  title?: string;
  comment: string;
  imageIds?: string[];
}

export const reviewsService = {
  async create(data: CreateReviewDto): Promise<Review> {
    return apiClient.post<Review>("/reviews", data, true);
  },

  async update(id: string, data: Partial<CreateReviewDto>): Promise<Review> {
    return apiClient.patch<Review>(`/reviews/${id}`, data, true);
  },

  async addProviderResponse(id: string, response: string): Promise<Review> {
    return apiClient.post<Review>(`/reviews/${id}/response`, { response }, true);
  },

  async report(id: string, reason: string): Promise<void> {
    return apiClient.post(`/reviews/${id}/report`, { reason }, true);
  },

  async markHelpful(id: string): Promise<void> {
    return apiClient.post(`/reviews/${id}/helpful`, {}, true);
  },

  async getByProvider(
    providerId: string,
    params?: {
      page?: number;
      limit?: number;
      sortBy?: "rating" | "createdAt" | "helpfulCount";
      sortOrder?: "asc" | "desc";
    },
  ): Promise<PaginatedResponse<Review>> {
    const qs = buildQueryString(params || {});
    const raw = await apiClient.get<{
      items: Review[];
      total: number;
      page: number;
      limit: number;
      totalPages: number;
    }>(`/reviews/provider/${providerId}${qs}`);
    return {
      data: raw.items ?? [],
      pagination: {
        page: raw.page ?? 1,
        limit: raw.limit ?? (raw.items?.length ?? 0),
        total: raw.total ?? 0,
        totalPages: raw.totalPages ?? 1,
      },
    };
  },
};
