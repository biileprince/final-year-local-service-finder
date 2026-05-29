import type { MetadataRoute } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

// Rebuild the sitemap hourly so newly-listed providers get indexed without a
// full redeploy.
export const revalidate = 3600;

interface ProviderRow {
  id: string;
  updatedAt?: string;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes: MetadataRoute.Sitemap = [
    { path: "", priority: 1, changeFrequency: "daily" as const },
    { path: "/search", priority: 0.8, changeFrequency: "daily" as const },
    { path: "/privacy", priority: 0.3, changeFrequency: "yearly" as const },
    { path: "/terms", priority: 0.3, changeFrequency: "yearly" as const },
    { path: "/cookies", priority: 0.3, changeFrequency: "yearly" as const },
  ].map((r) => ({
    url: `${SITE_URL}${r.path}`,
    lastModified: new Date(),
    changeFrequency: r.changeFrequency,
    priority: r.priority,
  }));

  let providerRoutes: MetadataRoute.Sitemap = [];
  try {
    const res = await fetch(`${API_URL}/providers?limit=500`, {
      next: { revalidate: 3600 },
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
  } catch {
    // Network/API hiccup — the static routes still produce a valid sitemap.
  }

  return [...staticRoutes, ...providerRoutes];
}
