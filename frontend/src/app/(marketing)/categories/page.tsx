import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { ArrowRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { JsonLd } from "@/components/seo/json-ld";
import { getCategories } from "@/lib/seo-data";
import { buildSiteKeywords } from "@/lib/seo";

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
const FALLBACK_IMAGE =
  "https://images.unsplash.com/photo-1503387762-592deb58ef4e?auto=format&fit=crop&w=800&q=80";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "All Service Categories in Ghana",
  description:
    "Browse every service on Local Service Finder — plumbing, electrical, cleaning, auto repair, beauty & hair, photography and more. Find and book verified local pros across Ghana.",
  keywords: buildSiteKeywords(),
  alternates: { canonical: "/categories" },
  openGraph: {
    title: "All Service Categories in Ghana | Local Service Finder",
    description:
      "Browse every service and book verified local pros across Ghana.",
    url: "/categories",
  },
};

export default async function CategoriesHubPage() {
  const categories = await getCategories();

  const itemListJsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "Service categories on Local Service Finder",
    itemListElement: categories.map((c, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: c.name,
      url: `${SITE_URL}/categories/${c.slug}`,
    })),
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-16 sm:px-8 lg:px-8">
      <JsonLd data={itemListJsonLd} />

      <header className="max-w-3xl">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary-600">
          Browse services
        </p>
        <h1 className="mt-3 text-4xl font-bold tracking-tight text-secondary-900 sm:text-5xl">
          All service categories in Ghana
        </h1>
        <p className="mt-4 text-lg text-secondary-600">
          From plumbing and electrical work to cleaning, auto repair, beauty and
          photography — find verified local professionals near you and book in
          minutes. Every provider is reviewed by real customers.
        </p>
      </header>

      {categories.length === 0 ? (
        <p className="mt-12 text-center text-secondary-500">
          Categories are being added soon.
        </p>
      ) : (
        <div className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {categories.map((category) => {
            const imageUrl = category.image?.url || FALLBACK_IMAGE;
            const accent = category.color || "#3B82F6";
            return (
              <Link
                key={category.id}
                href={`/categories/${category.slug}`}
                className="group block"
              >
                <Card
                  className="h-full overflow-hidden shadow-soft transition-all group-hover:-translate-y-1 group-hover:shadow-xl"
                  style={{ borderTop: `3px solid ${accent}` }}
                >
                  <div className="relative h-44 w-full overflow-hidden bg-secondary-100">
                    <Image
                      src={imageUrl}
                      alt={`${category.name} services in Ghana`}
                      width={800}
                      height={600}
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                  </div>
                  <CardContent className="p-6">
                    <h2 className="text-xl font-bold text-secondary-900">
                      {category.name}
                    </h2>
                    {category.description && (
                      <p className="mt-2 text-base text-secondary-600">
                        {category.description}
                      </p>
                    )}
                    <div className="mt-5 flex items-center justify-between">
                      <span className="text-sm font-medium text-secondary-500">
                        {category.providerCount}+ providers
                      </span>
                      <span className="inline-flex items-center gap-1 text-sm font-semibold text-primary-700">
                        View pros
                        <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
