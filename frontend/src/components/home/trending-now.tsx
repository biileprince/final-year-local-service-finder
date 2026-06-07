import Link from "next/link";
import { ArrowRight, Sparkles, Star, TrendingUp } from "lucide-react";

interface TrendingPayload {
  categories: Array<{
    id: string;
    name: string;
    slug: string;
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

async function fetchTrending(): Promise<TrendingPayload | null> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
  try {
    const res = await fetch(`${apiUrl}/search/trending`, {
      next: { revalidate: 180 },
    });
    if (!res.ok) return null;
    return (await res.json()) as TrendingPayload;
  } catch {
    return null;
  }
}

export async function TrendingNow() {
  const trending = await fetchTrending();
  if (!trending) return null;
  const hasSearches = trending.topSearches.length > 0;
  const hasProviders = trending.popularProviders.length > 0;
  if (!hasSearches && !hasProviders) return null;

  return (
    <section className="bg-white py-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-primary-600">
              <TrendingUp className="h-3.5 w-3.5" />
              What&apos;s trending
            </p>
            <h2 className="mt-2 text-3xl font-bold text-secondary-900 sm:text-4xl">
              Hot right now
            </h2>
            <p className="mt-3 max-w-2xl text-base text-secondary-600">
              The services and providers people in your area are booking the
              most this month.
            </p>
          </div>
        </div>

        {hasSearches && (
          <div className="mt-8 flex flex-wrap gap-2">
            {trending.topSearches.map((term) => (
              <Link
                key={term}
                href={`/search?q=${encodeURIComponent(term)}`}
                className="group inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-bold capitalize text-gray-700 transition-all hover:border-primary-300 hover:bg-primary-50 hover:text-primary-700"
              >
                <Sparkles className="h-3.5 w-3.5 text-primary-500" />
                {term}
              </Link>
            ))}
          </div>
        )}

        {hasProviders && (
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {trending.popularProviders.slice(0, 4).map((p) => (
              <Link
                key={p.id}
                href={`/providers/${p.id}`}
                className="group rounded-2xl border border-gray-200 bg-white p-4 transition-all hover:-translate-y-1 hover:border-primary-300 hover:shadow-lg"
              >
                <div className="flex items-center gap-3">
                  {p.profileImage ? (
                    <span
                      className="h-12 w-12 shrink-0 rounded-full bg-cover bg-center"
                      style={{ backgroundImage: `url(${p.profileImage})` }}
                    />
                  ) : (
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary-50 text-base font-bold text-primary-700">
                      {p.name.charAt(0)}
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-gray-900">
                      {p.name}
                    </p>
                    <p className="truncate text-xs text-gray-500">
                      {p.primaryCategory
                        ? `${p.primaryCategory} · ${p.location}`
                        : p.location}
                    </p>
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between text-sm">
                  <span className="flex items-center gap-1 font-bold text-gray-700">
                    <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                    {p.rating.toFixed(1)}
                    <span className="ml-0.5 font-medium text-gray-400">
                      ({p.reviewCount})
                    </span>
                  </span>
                  <ArrowRight className="h-4 w-4 text-gray-300 transition-all group-hover:translate-x-0.5 group-hover:text-primary-500" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
