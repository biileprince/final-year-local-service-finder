import { apiClient, buildQueryString } from "./client";
import type { Review } from "@/types";

export interface CreateReviewDto {
  bookingId: string;
  rating: number;
  title?: string;
  comment: string;
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
};
