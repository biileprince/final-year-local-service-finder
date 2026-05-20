"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Heart, Search } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { ProviderCard } from "@/components/providers/provider-card";
import { favoritesService, type FavoriteListItem } from "@/lib/api";

export default function FavoritesPage() {
  const [items, setItems] = useState<FavoriteListItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await favoritesService.list();
        if (!cancelled) setItems(list);
      } catch (err) {
        if (!cancelled)
          setError(
            err instanceof Error ? err.message : "Failed to load favorites",
          );
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-secondary-900">Saved providers</h1>
        <p className="mt-2 text-secondary-600">
          Quick access to the providers you&rsquo;ve bookmarked for later.
        </p>
      </div>

      {items === null && !error ? (
        <div className="flex justify-center py-16">
          <Spinner size="lg" />
        </div>
      ) : error ? (
        <Card className="p-8 text-center">
          <p className="text-sm font-semibold text-error-700">{error}</p>
        </Card>
      ) : items && items.length === 0 ? (
        <Card className="flex flex-col items-center gap-4 p-12 text-center">
          <div className="rounded-full bg-rose-50 p-4">
            <Heart className="h-8 w-8 text-rose-500" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-secondary-900">
              No saved providers yet
            </h2>
            <p className="mt-2 text-sm text-secondary-600">
              Tap the heart on any provider card to keep them handy for later.
            </p>
          </div>
          <Button asChild>
            <Link href="/search">
              <Search className="mr-2 h-4 w-4" />
              Browse providers
            </Link>
          </Button>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {items?.map((item) => (
            <ProviderCard key={item.provider.id} provider={item.provider} />
          ))}
        </div>
      )}
    </div>
  );
}
