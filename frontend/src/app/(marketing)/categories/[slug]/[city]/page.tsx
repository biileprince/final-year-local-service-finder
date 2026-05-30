import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CategoryLanding } from "@/components/seo/category-landing";
import {
  getCategories,
  getCategoryBySlug,
  getProvidersForCategory,
} from "@/lib/seo-data";
import { CITIES, findCityBySlug, buildProviderKeywords } from "@/lib/seo";

export const revalidate = 3600;
export const dynamicParams = true;

export async function generateStaticParams() {
  const categories = await getCategories();
  // Pre-render the full category × city matrix — both sets are small and these
  // are the highest-intent ("plumber in Accra") long-tail pages.
  return categories.flatMap((c) =>
    CITIES.map((city) => ({ slug: c.slug, city: city.slug })),
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; city: string }>;
}): Promise<Metadata> {
  const { slug, city: citySlug } = await params;
  const [category, city] = [await getCategoryBySlug(slug), findCityBySlug(citySlug)];
  if (!category || !city) {
    return { title: "Service category", robots: { index: false } };
  }

  const name = category.name;
  const title = `${name} in ${city.name} — Hire Verified ${name} Providers`;
  const description =
    `Find and book trusted ${name.toLowerCase()} providers in ${city.name}, Ghana. ` +
    `Compare ratings, reviews and prices from local pros, then book in minutes.`;

  return {
    title,
    description,
    keywords: buildProviderKeywords(name, city.name),
    alternates: { canonical: `/categories/${slug}/${citySlug}` },
    openGraph: {
      type: "website",
      title: `${title} | Local Service Finder`,
      description,
      url: `/categories/${slug}/${citySlug}`,
    },
  };
}

export default async function CategoryCityPage({
  params,
}: {
  params: Promise<{ slug: string; city: string }>;
}) {
  const { slug, city: citySlug } = await params;
  const city = findCityBySlug(citySlug);
  if (!city) notFound();

  const category = await getCategoryBySlug(slug);
  if (!category) notFound();

  const { providers } = await getProvidersForCategory(category.id, {
    location: city.name,
    limit: 12,
  });

  return (
    <CategoryLanding category={category} providers={providers} city={city} />
  );
}
