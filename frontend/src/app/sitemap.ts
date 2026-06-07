import type { MetadataRoute } from "next";
import { CITIES } from "@/lib/seo";

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
const API_FETCH_TIMEOUT_MS = 5000;

// Rebuild the sitemap hourly so newly-listed providers get indexed without a
// full redeploy.
export const revalidate = 3600;

interface ProviderRow {
  id: string;
  updatedAt?: string;
}

interface CategoryRow {
  slug: string;
  updatedAt?: string;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes: MetadataRoute.Sitemap = [
    { path: "", priority: 1, changeFrequency: "daily" as const },
    { path: "/search", priority: 0.8, changeFrequency: "daily" as const },
    { path: "/categories", priority: 0.8, changeFrequency: "weekly" as const },
    { path: "/privacy", priority: 0.3, changeFrequency: "yearly" as const },
    { path: "/terms", priority: 0.3, changeFrequency: "yearly" as const },
    { path: "/cookies", priority: 0.3, changeFrequency: "yearly" as const },
  ].map((r) => ({
    url: `${SITE_URL}${r.path}`,
    lastModified: new Date(),
    changeFrequency: r.changeFrequency,
    priority: r.priority,
  }));

  // Category landing pages + the category × city long-tail matrix.
  const categoryRoutes: MetadataRoute.Sitemap = [];
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), API_FETCH_TIMEOUT_MS);
    try {
      const res = await fetch(`${API_URL}/categories`, {
        next: { revalidate: 3600 },
        signal: controller.signal,
      });
      if (res.ok) {
        const cats = (await res.json()) as CategoryRow[];
        for (const c of cats) {
          categoryRoutes.push({
            url: `${SITE_URL}/categories/${c.slug}`,
            lastModified: c.updatedAt ? new Date(c.updatedAt) : new Date(),
            changeFrequency: "weekly",
            priority: 0.7,
          });
          for (const city of CITIES) {
            categoryRoutes.push({
              url: `${SITE_URL}/categories/${c.slug}/${city.slug}`,
              lastModified: new Date(),
              changeFrequency: "weekly",
              priority: 0.6,
            });
          }
        }
      }
    } finally {
      clearTimeout(timeout);
    }
  } catch {
    // Static routes still produce a valid sitemap.
  }

  let providerRoutes: MetadataRoute.Sitemap = [];
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), API_FETCH_TIMEOUT_MS);
    try {
      const res = await fetch(`${API_URL}/providers?limit=500`, {
        next: { revalidate: 3600 },
        signal: controller.signal,
      });
      if (res.ok) {
        const data = await res.json();
        const list: ProviderRow[] = Array.isArray(data)
          ? data
          : (data.items ?? data.providers ?? []);
        providerRoutes = list.map((p) => ({
          url: `${SITE_URL}/providers/${p.id}`,
          lastModified: p.updatedAt ? new Date(p.updatedAt) : new Date(),
          changeFrequency: "weekly" as const,
          priority: 0.7,
        }));
      }
    } finally {
      clearTimeout(timeout);
    }
  } catch {
    // Network/API hiccup — the static routes still produce a valid sitemap.
  }

  return [...staticRoutes, ...categoryRoutes, ...providerRoutes];
}
