import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CategoryLanding } from "@/components/seo/category-landing";
import {
  getCategories,
  getCategoryBySlug,
  getProvidersForCategory,
} from "@/lib/seo-data";
import { buildProviderKeywords } from "@/lib/seo";

export const revalidate = 3600;
// Slugs not returned by generateStaticParams still render on demand (ISR).
export const dynamicParams = true;

export async function generateStaticParams() {
  const categories = await getCategories();
  return categories.map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const category = await getCategoryBySlug(slug);
  if (!category) {
    return { title: "Service category", robots: { index: false } };
  }

  const name = category.name;
  const title = `${name} in Ghana — Hire Verified ${name} Providers`;
  const description =
    `Find and book trusted ${name.toLowerCase()} providers across Ghana. ` +
    `${category.description ?? ""} Compare ratings, reviews and prices, then book in minutes.`.trim();

  return {
    title,
    description,
    keywords: buildProviderKeywords(name, "Ghana"),
    alternates: { canonical: `/categories/${slug}` },
    openGraph: {
      type: "website",
      title: `${title} | Local Service Finder`,
      description,
      url: `/categories/${slug}`,
    },
  };
}

export default async function CategoryPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const category = await getCategoryBySlug(slug);
  if (!category) notFound();

  const { providers } = await getProvidersForCategory(category.id, {
    limit: 12,
  });

  return <CategoryLanding category={category} providers={providers} />;
}
