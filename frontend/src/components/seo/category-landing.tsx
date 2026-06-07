import Link from "next/link";
import { ShieldCheck, Star, Wallet, CalendarCheck, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProviderCard } from "@/components/providers/provider-card";
import { JsonLd } from "@/components/seo/json-ld";
import { CITIES, type City } from "@/lib/seo";
import type { Category, Provider } from "@/types";

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

interface CategoryLandingProps {
  category: Category;
  providers: Provider[];
  /** When set, the page is scoped to one city. */
  city?: City | null;
}

/** A lowercase, article-friendly form of the category name for prose. */
function svc(category: Category): string {
  return category.name.toLowerCase();
}

function buildFaqs(
  category: Category,
  cityName: string | null,
): { q: string; a: string }[] {
  const where = cityName ? `in ${cityName}` : "in Ghana";
  const name = svc(category);
  return [
    {
      q: `How do I find a trusted ${name} provider ${where}?`,
      a: `Browse verified ${name} providers ${where} on Local Service Finder, compare their ratings and reviews from real customers, then book the one that fits your budget and schedule.`,
    },
    {
      q: `Are the ${name} providers verified?`,
      a: `Yes. Providers submit ID and (where relevant) business documents, which our team reviews before their profile appears in search — so you only see vetted pros.`,
    },
    {
      q: `How much does ${name} cost ${where}?`,
      a: `Prices vary by job and provider. Each profile lists hourly rates and service prices up front, so you can compare and pick what works for you before booking.`,
    },
    {
      q: `How do I pay?`,
      a: `Payments are handled offline, directly between you and the provider. You agree the price on the platform and settle it in person — there are no online checkout fees.`,
    },
  ];
}

export function CategoryLanding({
  category,
  providers,
  city = null,
}: CategoryLandingProps) {
  const cityName = city?.name ?? null;
  const where = cityName ? `in ${cityName}` : "in Ghana";
  const name = svc(category);
  const canonicalPath = city
    ? `/categories/${category.slug}/${city.slug}`
    : `/categories/${category.slug}`;
  const faqs = buildFaqs(category, cityName);

  const breadcrumbItems = [
    { name: "Home", item: SITE_URL },
    { name: "Categories", item: `${SITE_URL}/categories` },
    { name: category.name, item: `${SITE_URL}/categories/${category.slug}` },
    ...(city
      ? [
          {
            name: city.name,
            item: `${SITE_URL}/categories/${category.slug}/${city.slug}`,
          },
        ]
      : []),
  ];

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: breadcrumbItems.map((b, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: b.name,
      item: b.item,
    })),
  };

  const collectionJsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: `${category.name} providers ${where}`,
    url: `${SITE_URL}${canonicalPath}`,
    about: category.name,
    mainEntity: {
      "@type": "ItemList",
      itemListElement: providers.slice(0, 12).map((p, i) => ({
        "@type": "ListItem",
        position: i + 1,
        url: `${SITE_URL}/providers/${p.id}`,
        name: p.user?.name,
      })),
    },
  };

  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };

  const benefits = [
    {
      icon: ShieldCheck,
      title: "Verified pros",
      body: "Every provider is ID-checked before they appear in search.",
    },
    {
      icon: Star,
      title: "Real reviews",
      body: "Ratings come from customers who actually booked the job.",
    },
    {
      icon: Wallet,
      title: "Clear pricing",
      body: "Rates are listed up front — no surprises, pay offline.",
    },
    {
      icon: CalendarCheck,
      title: "Book in minutes",
      body: "Pick a provider, choose a time, and you're set.",
    },
  ];

  return (
    <div className="bg-secondary-50">
      <JsonLd data={breadcrumbJsonLd} />
      <JsonLd data={collectionJsonLd} />
      <JsonLd data={faqJsonLd} />

      {/* Hero */}
      <div className="bg-white">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-8 lg:px-8">
          <nav className="flex flex-wrap items-center gap-1.5 text-sm text-secondary-500">
            <Link href="/" className="hover:text-secondary-800">
              Home
            </Link>
            <span aria-hidden>/</span>
            <Link href="/categories" className="hover:text-secondary-800">
              Categories
            </Link>
            <span aria-hidden>/</span>
            {city ? (
              <>
                <Link
                  href={`/categories/${category.slug}`}
                  className="hover:text-secondary-800"
                >
                  {category.name}
                </Link>
                <span aria-hidden>/</span>
                <span className="font-medium text-secondary-700">
                  {city.name}
                </span>
              </>
            ) : (
              <span className="font-medium text-secondary-700">
                {category.name}
              </span>
            )}
          </nav>

          <h1 className="mt-5 max-w-3xl text-4xl font-bold tracking-tight text-secondary-900 sm:text-5xl">
            {category.name} {where}
          </h1>
          <p className="mt-4 max-w-3xl text-lg text-secondary-600">
            {category.description ? `${category.description} ` : ""}
            Hire trusted, verified {name} providers {where} on Local Service
            Finder. Compare ratings and prices from real customer reviews, then
            book online in minutes.
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            <Button size="lg" asChild>
              <Link
                href={`/search?category=${category.slug}${
                  cityName ? `&location=${encodeURIComponent(cityName)}` : ""
                }`}
              >
                Browse all {name} providers
                <ArrowRight className="ml-1.5 h-5 w-5" />
              </Link>
            </Button>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl space-y-14 px-4 py-14 sm:px-8 lg:px-8">
        {/* Provider list */}
        <section>
          <h2 className="text-2xl font-bold text-secondary-900">
            Top {name} providers {where}
          </h2>
          {providers.length === 0 ? (
            <p className="mt-4 text-secondary-600">
              We&apos;re still onboarding {name} providers {where}.{" "}
              <Link href="/search" className="font-semibold text-primary-700">
                Browse all providers
              </Link>{" "}
              or{" "}
              <Link
                href="/register?role=provider"
                className="font-semibold text-primary-700"
              >
                list your service
              </Link>
              .
            </p>
          ) : (
            <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {providers.map((p) => (
                <ProviderCard key={p.id} provider={p} />
              ))}
            </div>
          )}
        </section>

        {/* Why book */}
        <section>
          <h2 className="text-2xl font-bold text-secondary-900">
            Why book {name} on Local Service Finder
          </h2>
          <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {benefits.map((b) => (
              <div
                key={b.title}
                className="rounded-2xl border border-secondary-100 bg-white p-5"
              >
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary-50 text-primary-700">
                  <b.icon className="h-5 w-5" />
                </div>
                <h3 className="mt-4 font-semibold text-secondary-900">
                  {b.title}
                </h3>
                <p className="mt-1 text-sm text-secondary-600">{b.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* City links — only on the country-level category page */}
        {!city && (
          <section>
            <h2 className="text-2xl font-bold text-secondary-900">
              {category.name} by city
            </h2>
            <p className="mt-2 text-secondary-600">
              Find {name} providers in your area.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              {CITIES.map((c) => (
                <Link
                  key={c.slug}
                  href={`/categories/${category.slug}/${c.slug}`}
                  className="rounded-full border border-secondary-200 bg-white px-4 py-2 text-sm font-medium text-secondary-700 transition-colors hover:border-primary-300 hover:bg-primary-50 hover:text-primary-700"
                >
                  {category.name} in {c.name}
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* FAQ */}
        <section>
          <h2 className="text-2xl font-bold text-secondary-900">
            Frequently asked questions
          </h2>
          <div className="mt-6 space-y-4">
            {faqs.map((f) => (
              <div
                key={f.q}
                className="rounded-2xl border border-secondary-100 bg-white p-5"
              >
                <h3 className="font-semibold text-secondary-900">{f.q}</h3>
                <p className="mt-2 text-secondary-600">{f.a}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
