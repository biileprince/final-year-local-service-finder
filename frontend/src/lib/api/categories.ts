import { apiClient } from "./client";
import type { Category } from "@/types";

export const categoriesService = {
  async getAll(): Promise<Category[]> {
    return apiClient.get<Category[]>("/categories");
  },

  async getById(id: string): Promise<Category> {
    return apiClient.get<Category>(`/categories/${id}`);
  },

  async getBySlug(slug: string): Promise<Category> {
    return apiClient.get<Category>(`/categories/slug/${slug}`);
  },

  async getPopular(limit = 8): Promise<Category[]> {
    const categories = await this.getAll();
    return categories
      .sort((a, b) => b.providerCount - a.providerCount)
      .slice(0, limit);
  },
};
