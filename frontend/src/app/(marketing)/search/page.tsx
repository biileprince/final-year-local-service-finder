"use client";

import {
  useState,
  useEffect,
  useMemo,
  useCallback,
  useRef,
  Suspense,
} from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  Search,
  MapPin,
  X,
  Grid3X3,
  List,
  Star,
  CheckCircle,
  Clock,
  Wrench,
  Zap,
  Sparkles,
  Hammer,
  Wind,
  Paintbrush,
  Filter,
} from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ProviderCard } from "@/components/providers/provider-card";
import { providersService, categoriesService } from "@/lib/api";
import type { Provider, Category } from "@/types";
import { cn, getInitials, formatCurrency } from "@/lib/utils";

const categoryIcons: Record<
  string,
  React.ComponentType<{ className?: string; strokeWidth?: number }>
> = {
  plumbing: Wrench,
  electrical: Zap,
  cleaning: Sparkles,
  handyman: Hammer,
  hvac: Wind,
  painting: Paintbrush,
};

type SortBy = "rating" | "price" | "reviews" | "distance";

export default function SearchPage() {
  return (
    <Suspense fallback={<SearchPageSkeleton />}>
      <SearchContent />
    </Suspense>
  );
}

function SearchContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const categoryParam = searchParams.get("category");
  const queryParam = searchParams.get("q") ?? "";

  const [searchQuery, setSearchQuery] = useState(queryParam);
  const [locationQuery, setLocationQuery] = useState(
    searchParams.get("location") ?? "",
  );
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [hideHeader, setHideHeader] = useState(false);
  const lastScrollY = useRef(0);

  const [selectedCategory, setSelectedCategory] = useState<string>(
    categoryParam ?? "all",
  );
  const [minRating, setMinRating] = useState<number>(0);
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [availabilityFilter, setAvailabilityFilter] = useState<string | null>(
    null,
  );
  const [sortBy, setSortBy] = useState<SortBy>("rating");

  const [categories, setCategories] = useState<Category[]>([]);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [providersLoading, setProvidersLoading] = useState(true);
  const [categoriesLoading, setCategoriesLoading] = useState(true);

  // Resolve slug-based category param to id (prototype uses slug)
  const resolvedCategoryId = useMemo(() => {
    if (selectedCategory === "all") return undefined;
    if (!categories.length) return undefined;
    const match = categories.find(
      (c) => c.id === selectedCategory || c.slug === selectedCategory,
    );
    return match?.id;
  }, [selectedCategory, categories]);

  useEffect(() => {
    let cancelled = false;
    setCategoriesLoading(true);
    (async () => {
      try {
        const data = await categoriesService.getAll();
        if (!cancelled) setCategories(data);
      } catch {
        if (!cancelled) setCategories([]);
      } finally {
        if (!cancelled) setCategoriesLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const onScroll = () => {
      const currentY = window.scrollY;
      const delta = currentY - lastScrollY.current;

      if (currentY < 80) {
        setHideHeader(false);
      } else if (delta > 6) {
        setHideHeader(true);
      } else if (delta < -6) {
        setHideHeader(false);
      }

      lastScrollY.current = currentY;
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const loadProviders = useCallback(async () => {
    setProvidersLoading(true);
    try {
      const result = await providersService.search({
        search: searchQuery || undefined,
        categoryId: resolvedCategoryId,
        minRating: minRating > 0 ? minRating : undefined,
        verified: verifiedOnly || undefined,
        sortBy,
        sortOrder: "desc",
        limit: 30,
      });
      setProviders(result.providers);
    } catch {
      setProviders([]);
    } finally {
      setProvidersLoading(false);
    }
  }, [searchQuery, resolvedCategoryId, minRating, verifiedOnly, sortBy]);

  useEffect(() => {
    loadProviders();
  }, [resolvedCategoryId, minRating, verifiedOnly, sortBy, loadProviders]);

  const onSubmitSearch = (e: React.FormEvent) => {
    e.preventDefault();
    loadProviders();
  };

  const handleCategoryChange = (slug: string) => {
    setSelectedCategory(slug);
    const params = new URLSearchParams(searchParams.toString());
    if (slug === "all") {
      params.delete("category");
    } else {
      params.set("category", slug);
    }
    router.push(`/search${params.toString() ? `?${params.toString()}` : ""}`);
  };

  const resetFilters = () => {
    setMinRating(0);
    setVerifiedOnly(false);
    setAvailabilityFilter(null);
    setSortBy("rating");
  };

  const activeFiltersCount =
    (minRating > 0 ? 1 : 0) +
    (verifiedOnly ? 1 : 0) +
    (availabilityFilter ? 1 : 0);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ============ Sticky search header ============ */}
      <div
        className={cn(
          "sticky top-16 z-30 border-b border-gray-200 bg-white transition-transform duration-200 lg:top-20",
          hideHeader
            ? "-translate-y-full opacity-0 pointer-events-none"
            : "translate-y-0 opacity-100",
        )}
      >
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
          <form
            onSubmit={onSubmitSearch}
            className="flex flex-col gap-4 lg:flex-row"
          >
            <div className="flex flex-1 flex-col gap-3 sm:flex-row">
              <div className="flex flex-1 items-center gap-3 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 transition-all focus-within:border-primary-500 focus-within:bg-white focus-within:ring-2 focus-within:ring-primary-500/20">
                <Search className="h-5 w-5 shrink-0 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search services or service providers..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-transparent text-sm font-medium outline-none placeholder:text-gray-500"
                  aria-label="Search"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    aria-label="Clear search"
                  >
                    <X className="h-4 w-4 text-gray-400 transition-colors hover:text-gray-700" />
                  </button>
                )}
              </div>
              <div className="flex flex-1 items-center gap-3 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 transition-all focus-within:border-primary-500 focus-within:bg-white focus-within:ring-2 focus-within:ring-primary-500/20 sm:max-w-[220px]">
                <MapPin className="h-5 w-5 shrink-0 text-gray-400" />
                <input
                  type="text"
                  placeholder="Location"
                  value={locationQuery}
                  onChange={(e) => setLocationQuery(e.target.value)}
                  className="w-full bg-transparent text-sm font-medium outline-none placeholder:text-gray-500"
                  aria-label="Location"
                />
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="hidden items-center rounded-xl bg-gray-100 p-1 sm:flex">
                <button
                  type="button"
                  onClick={() => setViewMode("grid")}
                  aria-label="Grid view"
                  aria-pressed={viewMode === "grid"}
                  className={cn(
                    "rounded-lg p-2 transition-all",
                    viewMode === "grid"
                      ? "bg-white text-primary-600 shadow-sm"
                      : "text-gray-500 hover:text-gray-700",
                  )}
                >
                  <Grid3X3 className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("list")}
                  aria-label="List view"
                  aria-pressed={viewMode === "list"}
                  className={cn(
                    "rounded-lg p-2 transition-all",
                    viewMode === "list"
                      ? "bg-white text-primary-600 shadow-sm"
                      : "text-gray-500 hover:text-gray-700",
                  )}
                >
                  <List className="h-4 w-4" />
                </button>
              </div>

              <Button type="submit" className="hidden sm:inline-flex">
                Search
              </Button>

              <Button
                type="button"
                variant="outline"
                onClick={() => setShowMobileFilters(true)}
                className="lg:hidden"
              >
                <Filter className="h-4 w-4" />
                Filters
                {activeFiltersCount > 0 && (
                  <Badge className="ml-1">{activeFiltersCount}</Badge>
                )}
              </Button>
            </div>
          </form>

          {/* Category pills */}
          <div className="no-scrollbar -mx-4 mt-4 flex items-center gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
            <CategoryPill
              active={selectedCategory === "all"}
              onClick={() => handleCategoryChange("all")}
            >
              All services
            </CategoryPill>
            {categories.map((c) => {
              const Icon = categoryIcons[c.slug] ?? Wrench;
              const slug = c.slug || c.id;
              return (
                <CategoryPill
                  key={c.id}
                  active={
                    selectedCategory === slug || selectedCategory === c.id
                  }
                  onClick={() => handleCategoryChange(slug)}
                >
                  <Icon className="h-4 w-4" strokeWidth={2} />
                  {c.name}
                </CategoryPill>
              );
            })}
          </div>
        </div>
      </div>

      {/* ============ Main body ============ */}
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex gap-6">
          {/* Desktop sidebar filters */}
          <aside className="hidden w-72 shrink-0 lg:block">
            <Card className="sticky top-44 p-6">
              <div className="mb-6 flex items-center justify-between">
                <h3 className="font-display text-lg font-bold text-gray-900">
                  Filters
                </h3>
                {activeFiltersCount > 0 && (
                  <button
                    onClick={resetFilters}
                    className="text-sm font-semibold text-primary-600 transition-colors hover:text-primary-700"
                  >
                    Clear all
                  </button>
                )}
              </div>

              {/* Service Category Filter */}
              <FilterGroup label="Service category">
                <RadioRow
                  active={selectedCategory === "all"}
                  onClick={() => handleCategoryChange("all")}
                  name="category"
                >
                  All services
                </RadioRow>
                {categories.map((c) => {
                  const Icon = categoryIcons[c.slug] ?? Wrench;
                  const slug = c.slug || c.id;
                  return (
                    <RadioRow
                      key={c.id}
                      active={
                        selectedCategory === slug || selectedCategory === c.id
                      }
                      onClick={() => handleCategoryChange(slug)}
                      name="category"
                    >
                      <Icon
                        className="h-4 w-4 text-primary-500"
                        strokeWidth={2}
                      />
                      {c.name}
                    </RadioRow>
                  );
                })}
              </FilterGroup>

              {/* Sort */}
              <FilterGroup label="Sort by">
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as SortBy)}
                  className="w-full rounded-xl border-2 border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-900 transition-all focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                >
                  <option value="rating">Highest rated</option>
                  <option value="reviews">Most reviewed</option>
                  <option value="price">Price: low to high</option>
                  <option value="distance">Nearest</option>
                </select>
              </FilterGroup>

              {/* Rating */}
              <FilterGroup label="Minimum rating">
                {[
                  { value: 0, label: "Any rating" },
                  { value: 4.5, label: "4.5+ stars" },
                  { value: 4.0, label: "4.0+ stars" },
                  { value: 3.5, label: "3.5+ stars" },
                ].map((opt) => (
                  <RadioRow
                    key={opt.value}
                    active={minRating === opt.value}
                    onClick={() => setMinRating(opt.value)}
                    name="rating"
                  >
                    {opt.value > 0 && (
                      <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                    )}
                    {opt.label}
                  </RadioRow>
                ))}
              </FilterGroup>

              {/* Availability */}
              <FilterGroup label="Availability">
                {[
                  { value: null, label: "Any time" },
                  { value: "today", label: "Available today" },
                  { value: "week", label: "This week" },
                ].map((opt) => (
                  <RadioRow
                    key={opt.label}
                    active={availabilityFilter === opt.value}
                    onClick={() => setAvailabilityFilter(opt.value)}
                    name="availability"
                  >
                    {opt.label}
                  </RadioRow>
                ))}
              </FilterGroup>

              {/* Verified */}
              <FilterGroup label="Trust" last>
                <label className="flex cursor-pointer items-center gap-3 rounded-xl bg-gray-50 p-3 transition-colors hover:bg-gray-100">
                  <input
                    type="checkbox"
                    checked={verifiedOnly}
                    onChange={(e) => setVerifiedOnly(e.target.checked)}
                    className="h-4 w-4 cursor-pointer rounded border-gray-300 text-primary-500 focus:ring-2 focus:ring-primary-500/30"
                  />
                  <CheckCircle className="h-4 w-4 text-blue-500" />
                  <span className="text-sm font-medium text-gray-900">
                    Verified service providers only
                  </span>
                </label>
              </FilterGroup>
            </Card>
          </aside>

          {/* Main content */}
          <div className="flex-1 min-w-0">
            {/* Results header */}
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <p className="text-gray-600">
                <span className="font-bold text-gray-900">
                  {providersLoading ? "—" : providers.length}
                </span>{" "}
                {providers.length === 1
                  ? "service provider"
                  : "service providers"}{" "}
                found
                {selectedCategory !== "all" && (
                  <span className="ml-1 capitalize">
                    {" "}
                    in {selectedCategory.replace(/-/g, " ")}
                  </span>
                )}
              </p>

              <div className="hidden items-center gap-2 md:flex">
                <QuickChip
                  active={verifiedOnly}
                  onClick={() => setVerifiedOnly(!verifiedOnly)}
                  tone="blue"
                >
                  <CheckCircle className="h-3.5 w-3.5" />
                  Verified
                </QuickChip>
                <QuickChip
                  active={availabilityFilter === "today"}
                  onClick={() =>
                    setAvailabilityFilter(
                      availabilityFilter === "today" ? null : "today",
                    )
                  }
                  tone="green"
                >
                  <Clock className="h-3.5 w-3.5" />
                  Today
                </QuickChip>
              </div>
            </div>

            {/* Active filter badges */}
            {activeFiltersCount > 0 && (
              <div className="mb-4 flex flex-wrap items-center gap-2">
                {minRating > 0 && (
                  <RemovableChip onRemove={() => setMinRating(0)}>
                    {minRating}+ stars
                  </RemovableChip>
                )}
                {verifiedOnly && (
                  <RemovableChip onRemove={() => setVerifiedOnly(false)}>
                    Verified only
                  </RemovableChip>
                )}
                {availabilityFilter && (
                  <RemovableChip onRemove={() => setAvailabilityFilter(null)}>
                    {availabilityFilter === "today"
                      ? "Available today"
                      : "This week"}
                  </RemovableChip>
                )}
              </div>
            )}

            {/* Loading */}
            {(providersLoading || categoriesLoading) && (
              <div
                className={cn(
                  viewMode === "grid"
                    ? "grid gap-4 sm:grid-cols-2 xl:grid-cols-3"
                    : "space-y-4",
                )}
              >
                {Array.from({ length: 6 }).map((_, i) => (
                  <Card key={i} className="animate-pulse p-5">
                    <div className="mb-3 flex items-start gap-4">
                      <div className="h-14 w-14 rounded-xl bg-gray-200" />
                      <div className="flex-1 space-y-2">
                        <div className="h-4 w-2/3 rounded bg-gray-200" />
                        <div className="h-3 w-1/3 rounded bg-gray-200" />
                      </div>
                    </div>
                    <div className="h-3 w-1/2 rounded bg-gray-200" />
                    <div className="mt-4 flex justify-end">
                      <div className="h-9 w-24 rounded-lg bg-gray-200" />
                    </div>
                  </Card>
                ))}
              </div>
            )}

            {/* Empty */}
            {!providersLoading && providers.length === 0 && (
              <Card className="p-12 text-center">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-gray-100">
                  <Search className="h-8 w-8 text-gray-400" />
                </div>
                <h3 className="mt-4 font-display text-xl font-bold text-gray-900">
                  No service providers found
                </h3>
                <p className="mt-1 text-gray-500">
                  Try adjusting your filters or search terms.
                </p>
                <Button
                  variant="outline"
                  onClick={resetFilters}
                  className="mt-5"
                >
                  Clear all filters
                </Button>
              </Card>
            )}

            {/* Results */}
            {!providersLoading && providers.length > 0 && (
              <>
                {viewMode === "grid" ? (
                  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                    {providers.map((p) => (
                      <ProviderGridCard key={p.id} provider={p} />
                    ))}
                  </div>
                ) : (
                  <div className="space-y-4">
                    {providers.map((p) => (
                      <ProviderCard key={p.id} provider={p} variant="row" />
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Platform Overview */}
      <div className="mx-auto max-w-7xl px-4 pb-12 sm:px-6 lg:px-8">
        <Card className="border-2 border-primary-100 p-6 md:p-8">
          <div className="mb-5 flex items-center justify-between">
            <h3 className="font-display text-lg font-bold text-gray-900 md:text-xl">
              Platform overview
            </h3>
            <Badge variant="soft">Live totals</Badge>
          </div>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <StatTile
              label="Verified service providers"
              value="850+"
              tone="orange"
            />
            <StatTile label="Categories" value="12" tone="blue" />
            <StatTile label="Bookings" value="12k+" tone="green" />
            <StatTile label="Avg. rating" value="4.9" tone="amber" />
          </div>
        </Card>
      </div>

      {/* Mobile Filters Drawer */}
      {showMobileFilters && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setShowMobileFilters(false)}
          />
          <div className="absolute bottom-0 right-0 top-0 w-full max-w-sm overflow-y-auto bg-white shadow-2xl">
            <div className="p-6">
              <div className="mb-6 flex items-center justify-between">
                <h3 className="font-display text-xl font-bold text-gray-900">
                  Filters &amp; sort
                </h3>
                <button
                  onClick={() => setShowMobileFilters(false)}
                  className="rounded-full p-2 text-gray-500 transition-colors hover:bg-gray-100"
                  aria-label="Close filters"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <FilterGroup label="Sort by">
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as SortBy)}
                  className="w-full rounded-xl border-2 border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                >
                  <option value="rating">Highest rated</option>
                  <option value="reviews">Most reviewed</option>
                  <option value="price">Price: low to high</option>
                  <option value="distance">Nearest</option>
                </select>
              </FilterGroup>

              <FilterGroup label="Minimum rating">
                {[0, 4.5, 4.0, 3.5].map((rating) => (
                  <RadioRow
                    key={rating}
                    active={minRating === rating}
                    onClick={() => setMinRating(rating)}
                    name="m-rating"
                  >
                    {rating === 0 ? "Any rating" : `${rating}+ stars`}
                  </RadioRow>
                ))}
              </FilterGroup>

              <FilterGroup label="Availability">
                {[
                  { value: null, label: "Any time" },
                  { value: "today", label: "Available today" },
                  { value: "week", label: "This week" },
                ].map((opt) => (
                  <RadioRow
                    key={opt.label}
                    active={availabilityFilter === opt.value}
                    onClick={() => setAvailabilityFilter(opt.value)}
                    name="m-availability"
                  >
                    {opt.label}
                  </RadioRow>
                ))}
              </FilterGroup>

              <FilterGroup label="Trust" last>
                <label className="flex cursor-pointer items-center gap-3 rounded-xl bg-gray-50 p-3">
                  <input
                    type="checkbox"
                    checked={verifiedOnly}
                    onChange={(e) => setVerifiedOnly(e.target.checked)}
                    className="h-4 w-4 cursor-pointer rounded border-gray-300 text-primary-500 focus:ring-2 focus:ring-primary-500/30"
                  />
                  <span className="text-sm font-medium">
                    Verified service providers only
                  </span>
                </label>
              </FilterGroup>

              <div className="flex gap-3 border-t border-gray-100 pt-4">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={resetFilters}
                >
                  Clear all
                </Button>
                <Button
                  className="flex-1"
                  onClick={() => setShowMobileFilters(false)}
                >
                  Show results
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/** Grid card matching prototype's ProviderGridCard, adapted for our types. */
function ProviderGridCard({ provider }: { provider: Provider }) {
  const verified = provider.verificationStatus === "VERIFIED";
  const primaryCategory =
    provider.categories.find((c) => c.isPrimary)?.category ??
    provider.categories[0]?.category;
  return (
    <Link
      href={`/providers/${provider.id}`}
      className="block rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2"
    >
      <Card className="h-full border-2 border-transparent p-5 transition-all hover:-translate-y-1 hover:border-primary-300 hover:shadow-lg">
        <div className="mb-4 flex items-start gap-4">
          <div className="relative">
            <Avatar className="h-14 w-14" size="lg">
              <AvatarImage
                src={provider.user.profileImage}
                alt={provider.user.name}
              />
              <AvatarFallback className="text-base font-bold">
                {getInitials(provider.user.name)}
              </AvatarFallback>
            </Avatar>
            {verified && (
              <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full border-2 border-white bg-blue-500">
                <CheckCircle className="h-3 w-3 text-white" />
              </span>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-base font-bold text-gray-900">
              {provider.user.name}
            </h3>
            <p className="truncate text-sm font-medium capitalize text-gray-600">
              {primaryCategory?.name ?? "Service provider"}
            </p>
            <div className="mt-1 flex items-center gap-1">
              <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
              <span className="text-sm font-bold text-gray-900">
                {Number(provider.rating).toFixed(1)}
              </span>
              <span className="text-xs text-gray-500">
                ({provider.reviewCount})
              </span>
            </div>
          </div>
        </div>

        <div className="mb-3 flex items-center gap-1 text-sm text-gray-600">
          <MapPin className="h-4 w-4 text-primary-500" />
          <span className="truncate font-medium">{provider.location}</span>
          <span className="text-gray-300">·</span>
          <span className="whitespace-nowrap">
            {provider.yearsExperience}+ yrs
          </span>
        </div>

        {provider.featured && (
          <Badge variant="warning" className="mb-3 gap-1">
            <Clock className="h-3 w-3" />
            Fast response
          </Badge>
        )}

        <div className="flex items-center justify-between border-t border-gray-100 pt-3">
          <p className="text-sm font-bold text-gray-900">
            {formatCurrency(Number(provider.hourlyRate))}
            <span className="ml-0.5 text-xs font-normal text-gray-500">
              /hr
            </span>
          </p>
          <Button size="sm">View &amp; Book</Button>
        </div>
      </Card>
    </Link>
  );
}

function CategoryPill({
  active,
  onClick,
  children,
}: {
  active?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2",
        active
          ? "bg-primary-500 text-white shadow-md shadow-primary-500/30"
          : "bg-gray-100 text-gray-700 hover:bg-gray-200",
      )}
    >
      {children}
    </button>
  );
}

function FilterGroup({
  label,
  children,
  last = false,
}: {
  label: string;
  children: React.ReactNode;
  last?: boolean;
}) {
  return (
    <div className={cn(last ? "mb-0" : "mb-6")}>
      <label className="mb-3 block text-sm font-semibold text-gray-700">
        {label}
      </label>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function RadioRow({
  active,
  onClick,
  name,
  children,
}: {
  active: boolean;
  onClick: () => void;
  name: string;
  children: React.ReactNode;
}) {
  return (
    <label
      className={cn(
        "flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-colors",
        active
          ? "border-primary-200 bg-primary-50"
          : "border-transparent bg-gray-50 hover:bg-gray-100",
      )}
    >
      <input
        type="radio"
        name={name}
        checked={active}
        onChange={onClick}
        className="h-4 w-4 cursor-pointer border-gray-300 text-primary-500 focus:ring-2 focus:ring-primary-500/30"
      />
      <span className="flex flex-1 items-center gap-2 text-sm font-medium text-gray-900">
        {children}
      </span>
    </label>
  );
}

function QuickChip({
  active,
  onClick,
  tone,
  children,
}: {
  active: boolean;
  onClick: () => void;
  tone: "blue" | "green";
  children: React.ReactNode;
}) {
  const tones = {
    blue: active
      ? "bg-blue-100 text-blue-700"
      : "bg-gray-100 text-gray-600 hover:bg-gray-200",
    green: active
      ? "bg-green-100 text-green-700"
      : "bg-gray-100 text-gray-600 hover:bg-gray-200",
  };
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors",
        tones[tone],
      )}
    >
      {children}
    </button>
  );
}

function RemovableChip({
  onRemove,
  children,
}: {
  onRemove: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onRemove}
      className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-700 transition-colors hover:bg-gray-200"
    >
      {children}
      <X className="h-3 w-3" />
    </button>
  );
}

const toneStyles: Record<string, string> = {
  orange: "bg-orange-50 text-orange-700",
  blue: "bg-blue-50 text-blue-700",
  green: "bg-emerald-50 text-emerald-700",
  amber: "bg-amber-50 text-amber-700",
};

function StatTile({
  label,
  value,
  tone,
}: {
  label: string;
  value: string | number;
  tone: keyof typeof toneStyles;
}) {
  return (
    <div className={cn("rounded-2xl p-4 text-center", toneStyles[tone])}>
      <p className="font-display text-2xl font-bold">{value}</p>
      <p className="mt-1 text-xs font-semibold opacity-80">{label}</p>
    </div>
  );
}

function SearchPageSkeleton() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="text-sm font-semibold text-gray-500">Loading…</div>
    </div>
  );
}
