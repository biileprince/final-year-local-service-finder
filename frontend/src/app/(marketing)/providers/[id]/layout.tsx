import type { Metadata } from "next";
import { buildProviderKeywords } from "@/lib/seo";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

interface ProviderLite {
  id?: string;
  user?: { name?: string };
  bio?: string;
  location?: string;
  rating?: number | string;
  reviewCount?: number;
  categories?: { category?: { name?: string } }[];
}

async function fetchProvider(id: string): Promise<ProviderLite | null> {
  try {
    const res = await fetch(`${API_URL}/providers/${id}`, {
      next: { revalidate: 3600 },
    });
    if (res.ok) return (await res.json()) as ProviderLite;
  } catch {
    /* fall through to generic metadata */
  }
  return null;
}

// The profile page itself is a client component, so it can't export metadata.
// This server layout fetches the provider and supplies per-page title,
// description, canonical, and social tags — the data search engines index.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const provider = await fetchProvider(id);

  if (!provider) {
    return {
      title: "Service provider",
      description: "Find trusted local service providers in Ghana.",
      alternates: { canonical: `/providers/${id}` },
    };
  }

  const name = provider.user?.name ?? "Service provider";
  const category = provider.categories?.[0]?.category?.name ?? "Local services";
  const location = provider.location ?? "Ghana";
  const rating = provider.rating ? Number(provider.rating).toFixed(1) : null;
  const reviewCount = provider.reviewCount ?? 0;

  const title = `${name} — ${category} in ${location}`;
  const description =
    provider.bio?.trim() ||
    `Book ${name}, a ${category.toLowerCase()} provider in ${location}.${
      rating ? ` Rated ${rating}/5 from ${reviewCount} reviews.` : ""
    } Verified on Local Service Finder.`;

  const canonical = `/providers/${provider.id ?? id}`;

  return {
    title,
    description,
    keywords: buildProviderKeywords(category, location),
    alternates: { canonical },
    openGraph: {
      type: "profile",
      title,
      description,
      url: canonical,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}

export default function ProviderProfileLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
