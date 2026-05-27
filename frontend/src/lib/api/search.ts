import { apiClient, buildQueryString } from "./client";
import type { Provider } from "@/types";

export type SuggestType = "category" | "provider" | "specialty" | "location";

export interface SuggestItem {
  type: SuggestType;
  id?: string;
  label: string;
  sublabel?: string;
  href: string;
  icon?: string;
  imageUrl?: string;
}

export interface SuggestResponse {
  query: string;
  groups: {
    categories: SuggestItem[];
    providers: SuggestItem[];
    specialties: SuggestItem[];
    locations: SuggestItem[];
  };
  topHit?: SuggestItem;
}

export interface TrendingResponse {
  categories: Array<{
    id: string;
    name: string;
    slug: string;
    icon: string | null;
    color: string | null;
    providerCount: number;
    bookings30d: number;
    imageUrl?: string;
  }>;
  topSearches: string[];
  popularProviders: Array<{
    id: string;
    name: string;
    location: string;
    rating: number;
    reviewCount: number;
    profileImage: string | null;
    primaryCategory?: string;
  }>;
}

export type ProviderSortBy =
  | "relevance"
  | "rating"
  | "reviews"
  | "distance"
  | "newest"
  | "priceLow"
  | "priceHigh";

export interface AdvancedSearchParams {
  q?: string;
  categoryIds?: string[];
  location?: string;
  lat?: number;
  lng?: number;
  radiusKm?: number;
  minRating?: number;
  maxHourlyRate?: number;
  verified?: boolean;
  availableToday?: boolean;
  sortBy?: ProviderSortBy;
  page?: number;
  limit?: number;
}

export interface AdvancedSearchResponse {
  items: (Provider & { distanceKm: number | null })[];
  providers: (Provider & { distanceKm: number | null })[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  meta: {
    query: string;
    hasGeo: boolean;
    radiusKm: number | null;
    sortBy: ProviderSortBy;
  };
}

export const searchService = {
  suggest(q: string, limit = 5, signal?: AbortSignal): Promise<SuggestResponse> {
    const qs = buildQueryString({ q, limit });
    return apiClient.get<SuggestResponse>(`/search/suggest${qs}`, false, {
      signal,
    });
  },

  trending(): Promise<TrendingResponse> {
    return apiClient.get<TrendingResponse>(`/search/trending`);
  },

  topLocations(limit = 8): Promise<Array<{ location: string; providerCount: number }>> {
    return apiClient.get<Array<{ location: string; providerCount: number }>>(
      `/search/locations?limit=${limit}`,
    );
  },

  searchProviders(params: AdvancedSearchParams): Promise<AdvancedSearchResponse> {
    // categoryIds is sent comma-joined; the backend accepts both shapes.
    const flat: Record<string, unknown> = { ...params };
    if (params.categoryIds && params.categoryIds.length > 0) {
      flat.categoryIds = params.categoryIds.join(",");
    } else {
      delete flat.categoryIds;
    }
    const qs = buildQueryString(flat as Record<string, unknown>);
    return apiClient.get<AdvancedSearchResponse>(`/search/providers${qs}`);
  },
};
