"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import {
  Search,
  Filter,
  MapPin,
  Star,
  Clock,
  ChevronDown,
  X,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { providersService, categoriesService } from "@/lib/api";
import type { Provider, Category } from "@/types";
import { formatCurrency } from "@/lib/utils";

export default function SearchPage() {
  const searchParams = useSearchParams();
  const [providers, setProviders] = useState<Provider[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [totalResults, setTotalResults] = useState(0);
  const [showFilters, setShowFilters] = useState(false);

  // Filter state
  const [search, setSearch] = useState(searchParams.get("q") || "");
  const [selectedCategory, setSelectedCategory] = useState(
    searchParams.get("category") || ""
  );
  const [minRating, setMinRating] = useState<number | undefined>();
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [sortBy, setSortBy] = useState<"rating" | "price" | "reviews">("rating");

  useEffect(() => {
    loadCategories();
  }, []);

  useEffect(() => {
    loadProviders();
  }, [selectedCategory, minRating, verifiedOnly, sortBy]);

  const loadCategories = async () => {
    try {
      const data = await categoriesService.getAll();
      setCategories(data);
    } catch (error) {
      console.error("Failed to load categories:", error);
    }
  };

  const loadProviders = async () => {
    setIsLoading(true);
    try {
      const result = await providersService.search({
        search: search || undefined,
        categoryId: selectedCategory || undefined,
        minRating,
        verified: verifiedOnly || undefined,
        sortBy,
        sortOrder: "desc",
        limit: 20,
      });
      setProviders(result.providers);
      setTotalResults(result.total);
    } catch (error) {
      console.error("Failed to load providers:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    loadProviders();
  };

  const clearFilters = () => {
    setSelectedCategory("");
    setMinRating(undefined);
    setVerifiedOnly(false);
    setSortBy("rating");
  };

  return (
    <div className="min-h-screen bg-secondary-50">
      {/* Search Header */}
      <div className="bg-white shadow-sm">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <form onSubmit={handleSearch} className="flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-secondary-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search for services or providers..."
                className="h-12 w-full rounded-lg border border-secondary-300 bg-white pl-10 pr-4 text-secondary-900 placeholder:text-secondary-400 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
              />
            </div>
            <Button type="submit" size="lg">
              Search
            </Button>
            <Button
              type="button"
              variant="outline"
              size="lg"
              onClick={() => setShowFilters(!showFilters)}
              className="lg:hidden"
            >
              <Filter className="h-5 w-5" />
            </Button>
          </form>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex gap-8">
          {/* Filters Sidebar */}
          <aside
            className={`${
              showFilters ? "fixed inset-0 z-50 bg-white p-6" : "hidden"
            } w-full lg:relative lg:block lg:w-64 lg:shrink-0`}
          >
            <div className="flex items-center justify-between lg:hidden">
              <h2 className="text-lg font-semibold">Filters</h2>
              <button onClick={() => setShowFilters(false)}>
                <X className="h-6 w-6" />
              </button>
            </div>

            <div className="mt-6 space-y-6 lg:mt-0">
              {/* Category Filter */}
              <div>
                <h3 className="text-sm font-semibold text-secondary-900">
                  Category
                </h3>
                <div className="mt-3 space-y-2">
                  <button
                    onClick={() => setSelectedCategory("")}
                    className={`w-full rounded-lg px-3 py-2 text-left text-sm ${
                      !selectedCategory
                        ? "bg-primary-50 text-primary-700"
                        : "text-secondary-600 hover:bg-secondary-100"
                    }`}
                  >
                    All Categories
                  </button>
                  {categories.map((category) => (
                    <button
                      key={category.id}
                      onClick={() => setSelectedCategory(category.id)}
                      className={`w-full rounded-lg px-3 py-2 text-left text-sm ${
                        selectedCategory === category.id
                          ? "bg-primary-50 text-primary-700"
                          : "text-secondary-600 hover:bg-secondary-100"
                      }`}
                    >
                      {category.name}
                      <span className="ml-1 text-secondary-400">
                        ({category.providerCount})
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Rating Filter */}
              <div>
                <h3 className="text-sm font-semibold text-secondary-900">
                  Minimum Rating
                </h3>
                <div className="mt-3 space-y-2">
                  {[4, 3, 2].map((rating) => (
                    <button
                      key={rating}
                      onClick={() =>
                        setMinRating(minRating === rating ? undefined : rating)
                      }
                      className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm ${
                        minRating === rating
                          ? "bg-primary-50 text-primary-700"
                          : "text-secondary-600 hover:bg-secondary-100"
                      }`}
                    >
                      <Star className="h-4 w-4 fill-warning-500 text-warning-500" />
                      {rating}+ stars
                    </button>
                  ))}
                </div>
              </div>

              {/* Verified Filter */}
              <div>
                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={verifiedOnly}
                    onChange={(e) => setVerifiedOnly(e.target.checked)}
                    className="h-4 w-4 rounded border-secondary-300 text-primary-600 focus:ring-primary-500"
                  />
                  <span className="text-sm text-secondary-700">
                    Verified providers only
                  </span>
                </label>
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={clearFilters}
                className="w-full"
              >
                Clear Filters
              </Button>
            </div>
          </aside>

          {/* Results */}
          <div className="flex-1">
            {/* Results Header */}
            <div className="mb-6 flex items-center justify-between">
              <p className="text-secondary-600">
                {isLoading ? (
                  "Searching..."
                ) : (
                  <>
                    <span className="font-semibold text-secondary-900">
                      {totalResults}
                    </span>{" "}
                    providers found
                  </>
                )}
              </p>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="rounded-lg border border-secondary-300 bg-white px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
              >
                <option value="rating">Sort by: Rating</option>
                <option value="price">Sort by: Price</option>
                <option value="reviews">Sort by: Reviews</option>
              </select>
            </div>

            {/* Provider Cards */}
            {isLoading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
              </div>
            ) : providers.length === 0 ? (
              <div className="rounded-xl bg-white p-12 text-center">
                <p className="text-lg font-medium text-secondary-900">
                  No providers found
                </p>
                <p className="mt-2 text-secondary-600">
                  Try adjusting your filters or search terms
                </p>
                <Button onClick={clearFilters} className="mt-4">
                  Clear Filters
                </Button>
              </div>
            ) : (
              <div className="grid gap-4">
                {providers.map((provider) => (
                  <ProviderCard key={provider.id} provider={provider} />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function ProviderCard({ provider }: { provider: Provider }) {
  return (
    <Link href={`/providers/${provider.id}`}>
      <Card className="transition-all hover:-translate-y-0.5 hover:shadow-soft-lg">
        <CardContent className="flex gap-4 p-4 sm:p-6">
          <Avatar
            size="xl"
            src={provider.user.profileImage}
            name={provider.user.name}
          />
          <div className="flex-1">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-semibold text-secondary-900">
                  {provider.user.name}
                </h3>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  {provider.categories.slice(0, 2).map((pc) => (
                    <Badge key={pc.id} variant="secondary">
                      {pc.category.name}
                    </Badge>
                  ))}
                  {provider.verificationStatus === "VERIFIED" && (
                    <Badge variant="success">Verified</Badge>
                  )}
                </div>
              </div>
              <div className="text-right">
                <p className="text-lg font-bold text-primary-600">
                  {formatCurrency(Number(provider.hourlyRate))}
                </p>
                <p className="text-xs text-secondary-500">per hour</p>
              </div>
            </div>

            <p className="mt-2 line-clamp-2 text-sm text-secondary-600">
              {provider.bio || "No description available"}
            </p>

            <div className="mt-3 flex flex-wrap items-center gap-4 text-sm text-secondary-500">
              <div className="flex items-center gap-1">
                <Star className="h-4 w-4 fill-warning-500 text-warning-500" />
                <span className="font-medium text-secondary-900">
                  {Number(provider.rating).toFixed(1)}
                </span>
                <span>({provider.reviewCount} reviews)</span>
              </div>
              <div className="flex items-center gap-1">
                <MapPin className="h-4 w-4" />
                <span>{provider.location}</span>
              </div>
              <div className="flex items-center gap-1">
                <Clock className="h-4 w-4" />
                <span>{provider.yearsExperience} years exp.</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
