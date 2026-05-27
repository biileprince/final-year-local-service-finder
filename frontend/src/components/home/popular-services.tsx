import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { Category } from "@/types";

const FALLBACK_IMAGE =
  "https://images.unsplash.com/photo-1503387762-592deb58ef4e?auto=format&fit=crop&w=800&q=80";

async function fetchCategories(): Promise<Category[]> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
  try {
    const res = await fetch(`${apiUrl}/categories/top?limit=9`, {
      // Revalidate every 5 minutes so admin updates show without a redeploy.
      next: { revalidate: 300 },
    });
    if (!res.ok) return [];
    return (await res.json()) as Category[];
  } catch {
    return [];
  }
}

export async function PopularServices() {
  const categories = await fetchCategories();

  return (
    <section id="popular-services" className="py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-8 lg:px-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-3xl font-bold text-secondary-900 sm:text-4xl">
              Popular services
            </h2>
            <p className="mt-4 text-lg text-secondary-600">
              We cover many services. If you provide a service, you can list it
              and reach customers who need it.
            </p>
          </div>
          <Button variant="outline" size="lg" asChild>
            <Link href="/categories">
              View all categories <ArrowRight className="ml-2 h-5 w-5" />
            </Link>
          </Button>
        </div>

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
                <Card
                  key={category.id}
                  className="overflow-hidden shadow-soft"
                  style={{ borderTop: `3px solid ${accent}` }}
                >
                  <div className="relative h-48 w-full overflow-hidden bg-secondary-100">
                    <Image
                      src={imageUrl}
                      alt={category.name}
                      width={800}
                      height={600}
                      className="h-full w-full object-cover transition-transform duration-300 hover:scale-105"
                    />
                  </div>
                  <CardContent className="p-6">
                    <h3 className="text-xl font-bold text-secondary-900">
                      {category.name}
                    </h3>
                    {category.description && (
                      <p className="mt-2 text-base text-secondary-600">
                        {category.description}
                      </p>
                    )}
                    <div className="mt-6 flex items-center justify-between">
                      <p className="text-sm font-medium text-secondary-500">
                        {category.providerCount}+ service providers
                      </p>
                      <Button size="default" asChild>
                        <Link href={`/search?category=${category.slug}`}>
                          View
                        </Link>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
