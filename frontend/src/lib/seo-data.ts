import type { Category, Provider } from "@/types";

// Server-side data access for the public SEO landing pages. Uses plain fetch
// (not the browser apiClient, which depends on localStorage tokens) against the
// public, unauthenticated endpoints, with ISR caching.

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

// Revalidate landing-page data hourly so new providers/categories appear
// without a redeploy.
const REVALIDATE_SECONDS = 3600;

export async function getCategories(): Promise<Category[]> {
  try {
    const res = await fetch(`${API_URL}/categories`, {
      next: { revalidate: REVALIDATE_SECONDS },
    });
    if (!res.ok) return [];
    return (await res.json()) as Category[];
  } catch {
    return [];
  }
}

export async function getCategoryBySlug(
  slug: string,
): Promise<Category | null> {
  try {
    const res = await fetch(
      `${API_URL}/categories/slug/${encodeURIComponent(slug)}`,
      { next: { revalidate: REVALIDATE_SECONDS } },
    );
    if (!res.ok) return null;
    return (await res.json()) as Category;
  } catch {
    return null;
  }
}

export interface CategoryProviders {
  providers: Provider[];
  total: number;
}

/**
 * Top providers for a category, optionally scoped to a city/location. Sorted
 * by rating so the strongest pros lead the page.
 */
export async function getProvidersForCategory(
  categoryId: string,
  options: { location?: string; limit?: number } = {},
): Promise<CategoryProviders> {
  const { location, limit = 12 } = options;
  const params = new URLSearchParams({
    categoryIds: categoryId,
    sortBy: "rating",
    limit: String(limit),
  });
  if (location) params.set("location", location);

  try {
    const res = await fetch(`${API_URL}/search/providers?${params}`, {
      next: { revalidate: REVALIDATE_SECONDS },
    });
    if (!res.ok) return { providers: [], total: 0 };
    const data = (await res.json()) as {
      items?: Provider[];
      providers?: Provider[];
      total?: number;
    };
    const providers = data.items ?? data.providers ?? [];
    return { providers, total: data.total ?? providers.length };
  } catch {
    return { providers: [], total: 0 };
  }
}
