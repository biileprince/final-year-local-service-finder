"use client";

import { useState, useEffect, useMemo, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
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
  Map as MapIcon,
  ChevronRight,
  Navigation,
} from "lucide-react";
import { ProvidersMap } from "@/components/providers/providers-map";
import { queryPermission } from "@/lib/permissions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ProviderCard } from "@/components/providers/provider-card";
import { SearchTrigger } from "@/components/search/search-trigger";
import { searchService, categoriesService, type ProviderSortBy } from "@/lib/api";
import type { Provider, Category } from "@/types";
import { cn } from "@/lib/utils";

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

type SortBy = ProviderSortBy;
type ProviderWithDistance = Provider & { distanceKm?: number | null };

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

  // Initial filter state seeded from the URL — every change writes back via
  // router.replace so /search?radiusKm=10&minRating=4.5 round-trips, making
  // result pages bookmarkable and shareable.
  const parseNumberParam = (key: string): number | null => {
    const raw = searchParams.get(key);
    if (raw === null) return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  };

  const [searchQuery, setSearchQuery] = useState(queryParam);
  const [locationQuery, setLocationQuery] = useState(
    searchParams.get("location") ?? "",
  );
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const [viewMode, setViewMode] = useState<"grid" | "list" | "map">("grid");
  // Map view: which provider's pin is currently active. Drives the route
  // overlay (when geo is on) and the highlight on the matching result card.
  const [selectedMapId, setSelectedMapId] = useState<string | null>(null);

  // Scroll visibility state
  const [isHeaderVisible, setIsHeaderVisible] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      // Make the header hide on scroll down, show on scroll up (especially for mobile)
      if (currentScrollY < 10) {
        setIsHeaderVisible(true);
      } else if (currentScrollY > lastScrollY && currentScrollY > 100) {
        // Scrolling down past 100px
        setIsHeaderVisible(false);
      } else if (currentScrollY < lastScrollY) {
        // Scrolling up
        setIsHeaderVisible(true);
      }
      setLastScrollY(currentScrollY);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [lastScrollY]);

  const [selectedCategory, setSelectedCategory] = useState<string>(
    categoryParam ?? "all",
  );
  const [minRating, setMinRating] = useState<number>(
    parseNumberParam("minRating") ?? 0,
  );
  const [verifiedOnly, setVerifiedOnly] = useState(
    searchParams.get("verified") === "true",
  );
  const [availabilityFilter, setAvailabilityFilter] = useState<string | null>(
    null,
  );
  const VALID_SORTS: SortBy[] = [
    "relevance",
    "rating",
    "reviews",
    "distance",
    "newest",
    "priceLow",
    "priceHigh",
  ];
  const [sortBy, setSortBy] = useState<SortBy>(() => {
    const raw = searchParams.get("sortBy");
    return raw && (VALID_SORTS as string[]).includes(raw)
      ? (raw as SortBy)
      : "relevance";
  });
  // Geo-radius: only active once the user grants location permission. If lat
  // + lng are in the URL we seed them so a shared link reconstructs the geo
  // filter without re-prompting; status stays "ready" because we trust the
  // caller already had permission when they generated the link.
  const initialLat = parseNumberParam("lat");
  const initialLng = parseNumberParam("lng");
  const [geo, setGeo] = useState<{ lat: number; lng: number } | null>(
    initialLat !== null && initialLng !== null
      ? { lat: initialLat, lng: initialLng }
      : null,
  );
  const [geoStatus, setGeoStatus] = useState<
    "idle" | "locating" | "ready" | "denied" | "unavailable" | "timeout" | "unsupported"
  >(initialLat !== null && initialLng !== null ? "ready" : "idle");
  const [radiusKm, setRadiusKm] = useState<number>(
    parseNumberParam("radiusKm") ?? 25,
  );

  const [categories, setCategories] = useState<Category[]>([]);
  const [providers, setProviders] = useState<ProviderWithDistance[]>([]);
  const [providersLoading, setProvidersLoading] = useState(true);
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const [totalResults, setTotalResults] = useState(0);

  const requestGeolocation = useCallback(async () => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setGeoStatus("unsupported");
      return;
    }
    // Geolocation requires a secure context. On localhost it works over http,
    // but anywhere else the browser silently returns POSITION_UNAVAILABLE.
    if (typeof window !== "undefined" && !window.isSecureContext) {
      setGeoStatus("unsupported");
      return;
    }
    // Check the Permissions API first: if the user already denied this site,
    // calling getCurrentPosition will reject instantly without ever showing
    // a prompt — which feels broken. Short-circuit to the guidance state.
    const perm = await queryPermission("geolocation");
    if (perm === "denied") {
      setGeoStatus("denied");
      return;
    }
    setGeoStatus("locating");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGeo({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setGeoStatus("ready");
        // Auto-switch sort to distance once geo is on (only if currently
        // on the default).
        setSortBy((s) => (s === "relevance" || s === "rating" ? "distance" : s));
      },
      (err) => {
        // Distinguish the three GeolocationPositionError codes so we can give
        // actionable messages: PERMISSION_DENIED (1), POSITION_UNAVAILABLE (2)
        // — laptops with no GPS and Windows location services off land here —
        // and TIMEOUT (3).
        if (err.code === err.PERMISSION_DENIED) setGeoStatus("denied");
        else if (err.code === err.TIMEOUT) setGeoStatus("timeout");
        else setGeoStatus("unavailable");
      },
      // Bump timeout — laptops without GPS fall back to WiFi/IP lookups which
      // can take longer than 8 s on the first request.
      { enableHighAccuracy: false, timeout: 15000, maximumAge: 5 * 60 * 1000 },
    );
  }, []);

  const clearGeo = useCallback(() => {
    setGeo(null);
    setGeoStatus("idle");
  }, []);

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

  const loadProviders = useCallback(async () => {
    setProvidersLoading(true);
    try {
      const result = await searchService.searchProviders({
        q: searchQuery || undefined,
        categoryIds: resolvedCategoryId ? [resolvedCategoryId] : undefined,
        location: locationQuery || undefined,
        lat: geo?.lat,
        lng: geo?.lng,
        radiusKm: geo ? radiusKm : undefined,
        minRating: minRating > 0 ? minRating : undefined,
        verified: verifiedOnly || undefined,
        sortBy,
        limit: 30,
      });
      setProviders(result.providers as ProviderWithDistance[]);
      setTotalResults(result.total);
    } catch {
      setProviders([]);
      setTotalResults(0);
    } finally {
      setProvidersLoading(false);
    }
  }, [
    searchQuery,
    resolvedCategoryId,
    locationQuery,
    geo,
    radiusKm,
    minRating,
    verifiedOnly,
    sortBy,
  ]);

  useEffect(() => {
    loadProviders();
  }, [
    resolvedCategoryId,
    minRating,
    verifiedOnly,
    sortBy,
    geo,
    radiusKm,
    loadProviders,
  ]);

  const onSubmitSearch = (e: React.FormEvent) => {
    e.preventDefault();
    loadProviders();
  };

  const handleCategoryChange = (slug: string) => {
    setSelectedCategory(slug);
  };

  // Mirror filter state into the URL so /search?category=plumbing&radiusKm=10
  // round-trips: state → URL, and a reload / shared link → state. We use
  // router.replace (not push) to keep the back button useful — otherwise every
  // slider tick would create a new history entry. The page never reads from
  // searchParams after the initial mount, so this effect can't loop.
  useEffect(() => {
    const params = new URLSearchParams();
    if (searchQuery.trim()) params.set("q", searchQuery.trim());
    if (locationQuery.trim()) params.set("location", locationQuery.trim());
    if (selectedCategory !== "all") params.set("category", selectedCategory);
    if (minRating > 0) params.set("minRating", String(minRating));
    if (verifiedOnly) params.set("verified", "true");
    if (sortBy !== "relevance") params.set("sortBy", sortBy);
    if (geo) {
      params.set("lat", geo.lat.toFixed(5));
      params.set("lng", geo.lng.toFixed(5));
      params.set("radiusKm", String(radiusKm));
    }
    const next = params.toString();
    const current = searchParams.toString();
    if (next === current) return;
    router.replace(`/search${next ? `?${next}` : ""}`, { scroll: false });
  }, [
    searchQuery,
    locationQuery,
    selectedCategory,
    minRating,
    verifiedOnly,
    sortBy,
    geo,
    radiusKm,
    router,
    searchParams,
  ]);

  const resetFilters = () => {
    setMinRating(0);
    setVerifiedOnly(false);
    setAvailabilityFilter(null);
    setSortBy(geo ? "distance" : "relevance");
  };

  const activeFiltersCount =
    (minRating > 0 ? 1 : 0) +
    (verifiedOnly ? 1 : 0) +
    (availabilityFilter ? 1 : 0) +
    (geo ? 1 : 0);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ============ Sticky search header ============ */}
      <div
        className={cn(
          "sticky z-30 border-b border-gray-200 bg-white transition-all duration-300",
          isHeaderVisible ? "top-0" : "-top-full"
        )}
      >
        {/* Search form */}
        <div className="">
          <div className="mx-auto max-w-7xl px-4 pt-3 pb-2 sm:px-6 lg:px-8">
            <form
              onSubmit={onSubmitSearch}
              className="flex flex-col gap-4 lg:flex-row"
            >
              <div className="flex flex-1 flex-col gap-3 sm:flex-row">
                {/* Mobile: open the robust typeahead overlay. */}
                <SearchTrigger
                  className="flex-1 px-3 py-3 sm:hidden"
                  placeholder={
                    searchQuery
                      ? searchQuery
                      : "Search services or service providers..."
                  }
                  showShortcut={false}
                />
                {/* Tablet+ : inline input for quick filter tweaks. */}
                <div className="hidden flex-1 items-center gap-3 rounded-xl border border-gray-200 bg-gray-50 px-3 py-3 transition-all focus-within:border-primary-500 focus-within:bg-white focus-within:ring-2 focus-within:ring-primary-500/20 sm:flex">
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
                <div className="flex flex-1 items-center gap-3 rounded-xl border border-gray-200 bg-gray-50 px-3 py-3 transition-all focus-within:border-primary-500 focus-within:bg-white focus-within:ring-2 focus-within:ring-primary-500/20 sm:max-w-[200px]">
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
                    title="Grid View"
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
                    title="List View"
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
                  <button
                    type="button"
                    title="Map View"
                    onClick={() => setViewMode("map")}
                    aria-label="Map view"
                    aria-pressed={viewMode === "map"}
                    className={cn(
                      "rounded-lg p-2 transition-all",
                      viewMode === "map"
                        ? "bg-white text-primary-600 shadow-sm"
                        : "text-gray-500 hover:text-gray-700",
                    )}
                  >
                    <MapIcon className="h-4 w-4" />
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
          </div>
        </div>

        {/* Category pills */}
        <div className="mx-auto max-w-7xl px-4 py-2 sm:px-6 lg:px-8">
          <div className="relative">
            <div
              id="search-category-pills"
              className="no-scrollbar -mx-4 flex items-center gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0"
            >
              <CategoryPill
                active={selectedCategory === "all"}
                onClick={() => handleCategoryChange("all")}
              >
                All Services
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
              {/* Spacer so the fade doesn't cover the last pill */}
              <div aria-hidden className="w-12 shrink-0 sm:w-16" />
            </div>
            {/* Right-edge gradient + arrow hints there's more to scroll. The pointer-events-none
                makes it click-through; the button on top stays clickable. */}
            <div
              aria-hidden
              className="pointer-events-none absolute right-0 top-0 h-full w-16 bg-linear-to-l from-white via-white/85 to-transparent"
            />
            <button
              type="button"
              aria-label="Scroll categories right"
              onClick={() => {
                const el = document.getElementById("search-category-pills");
                if (el) el.scrollBy({ left: 240, behavior: "smooth" });
              }}
              className="absolute right-0 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-600 shadow-md transition-colors hover:bg-primary-50 hover:text-primary-700"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
          <p className="mt-1 text-[11px] font-medium text-gray-500 sm:hidden">
            Swipe to see more services →
          </p>
        </div>
      </div>

      {/* ============ Main body ============ */}
      <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6 lg:px-8">
        <div className="flex gap-6">
          {/* Desktop sidebar filters */}
          <aside className="hidden w-72 shrink-0 lg:block">
            <Card className="sticky top-36 max-h-[calc(100vh-9rem)] overflow-y-auto p-6">
              <div className="mb-6 flex items-center justify-between">
                <h3 className="font-sans text-lg font-bold text-gray-900">
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
                <div className="max-h-52 overflow-y-auto space-y-2 pr-1">
                  <RadioRow
                    active={selectedCategory === "all"}
                    onClick={() => handleCategoryChange("all")}
                    name="category"
                  >
                    All Services
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
                </div>
              </FilterGroup>

              {/* Sort */}
              <FilterGroup label="Sort by">
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as SortBy)}
                  className="w-full rounded-xl border-2 border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-900 transition-all focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                >
                  <option value="relevance">Most relevant</option>
                  <option value="rating">Highest rated</option>
                  <option value="reviews">Most reviewed</option>
                  <option value="distance" disabled={!geo}>
                    Nearest {geo ? "" : "(turn on location)"}
                  </option>
                  <option value="newest">Newest</option>
                  <option value="priceLow">Price: low to high</option>
                  <option value="priceHigh">Price: high to low</option>
                </select>
              </FilterGroup>

              <GeoRadiusGroup
                geo={geo}
                geoStatus={geoStatus}
                radiusKm={radiusKm}
                onRequest={requestGeolocation}
                onClear={clearGeo}
                onRadiusChange={setRadiusKm}
              />

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
                  {providersLoading ? "—" : totalResults || providers.length}
                </span>{" "}
                {(totalResults || providers.length) === 1
                  ? "service provider"
                  : "service providers"}{" "}
                found
                {selectedCategory !== "all" && (
                  <span className="ml-1 capitalize">
                    {" "}
                    in {selectedCategory.replace(/-/g, " ")}
                  </span>
                )}
                {geo && (
                  <span className="ml-1">
                    {" "}
                    within{" "}
                    <span className="font-bold text-gray-900">{radiusKm} km</span>
                  </span>
                )}
              </p>

              <div className="flex flex-wrap items-center gap-2">
                {/* Near Me — prominent on the right so the user can find it
                    without opening the sidebar/filters drawer. */}
                {geo ? (
                  <button
                    type="button"
                    onClick={clearGeo}
                    className="inline-flex min-h-[44px] items-center gap-2 rounded-full bg-primary-100 px-4 py-2 text-sm font-bold text-primary-800 ring-2 ring-primary-300 transition-colors hover:bg-primary-200"
                  >
                    <Navigation className="h-4 w-4" />
                    Near me · {radiusKm} km
                    <X className="h-3.5 w-3.5" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={requestGeolocation}
                    disabled={geoStatus === "locating" || geoStatus === "unsupported"}
                    className="inline-flex min-h-[44px] items-center gap-2 rounded-full bg-primary-600 px-4 py-2 text-sm font-bold text-white shadow-md shadow-primary-500/30 transition-colors hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <Navigation className="h-4 w-4" />
                    {geoStatus === "locating" ? "Locating…" : "Near me"}
                  </button>
                )}
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
                {/* Quick jump to Map view — makes the map discoverable for users
                    who'd otherwise miss the small icon toggle in the header. */}
                <button
                  type="button"
                  onClick={() => setViewMode(viewMode === "map" ? "grid" : "map")}
                  className={cn(
                    "inline-flex min-h-[44px] items-center gap-2 rounded-full px-4 py-2 text-sm font-bold transition-colors",
                    viewMode === "map"
                      ? "bg-amber-100 text-amber-800 ring-2 ring-amber-300"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200",
                  )}
                >
                  <MapIcon className="h-4 w-4" />
                  {viewMode === "map" ? "Hide map" : "View on map"}
                </button>
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
                    ? "grid gap-6 sm:grid-cols-2 xl:grid-cols-3"
                    : "space-y-6",
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
                <h3 className="mt-4 font-sans text-xl font-bold text-gray-900">
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
                ) : viewMode === "list" ? (
                  <div className="space-y-6">
                    {providers.map((p) => (
                      <ProviderCard key={p.id} provider={p} variant="row" />
                    ))}
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Numbered strip first — cards at the top so the user
                        immediately sees who matched; the map below cross-references
                        them. Click a card to fly the map there and (when geo is on)
                        draw a driving route. */}
                    <div className="rounded-2xl border-2 border-primary-100 bg-primary-50/40 p-3">
                      <p className="mb-2 flex items-center gap-2 text-sm font-bold text-primary-800">
                        <MapIcon className="h-4 w-4" />
                        Tap a card to locate them on the map below
                      </p>
                      <div className="-mx-1 flex snap-x snap-mandatory gap-3 overflow-x-auto px-1 pb-2">
                      {providers.map((p, i) => {
                        const isSelected = selectedMapId === p.id;
                        const hasPin =
                          typeof p.latitude === "number" &&
                          typeof p.longitude === "number";
                        const primaryCategory =
                          p.categories.find((c) => c.isPrimary)?.category
                            ?.name ??
                          p.categories[0]?.category?.name ??
                          null;
                        const distance = (p as ProviderWithDistance).distanceKm;
                        return (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => setSelectedMapId(p.id)}
                            disabled={!hasPin}
                            aria-pressed={isSelected}
                            className={cn(
                              "group flex w-64 shrink-0 snap-start flex-col gap-2 rounded-xl border-2 bg-white p-3 text-left transition-shadow",
                              "disabled:cursor-not-allowed disabled:opacity-60",
                              isSelected
                                ? "border-amber-400 shadow-md ring-2 ring-amber-200"
                                : "border-secondary-200 hover:border-primary-300 hover:shadow-sm",
                            )}
                          >
                            <div className="flex items-start gap-2">
                              <span
                                className={cn(
                                  "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold",
                                  isSelected
                                    ? "bg-amber-500 text-white"
                                    : "bg-primary-600 text-white",
                                )}
                              >
                                {i + 1}
                              </span>
                              {p.user?.profileImage ? (
                                <Image
                                  src={p.user.profileImage}
                                  alt={p.user.name ?? "Provider"}
                                  width={40}
                                  height={40}
                                  className="h-10 w-10 shrink-0 rounded-full object-cover"
                                />
                              ) : (
                                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-secondary-100 text-secondary-500">
                                  <MapPin className="h-4 w-4" />
                                </div>
                              )}
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-semibold text-secondary-900">
                                  {p.user?.name ?? "Provider"}
                                </p>
                                {primaryCategory && (
                                  <p className="truncate text-xs text-secondary-500">
                                    {primaryCategory}
                                  </p>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center justify-between text-xs">
                              <span className="flex items-center gap-1 font-medium text-amber-600">
                                <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                                {p.rating > 0 ? p.rating.toFixed(1) : "New"}
                                {p.reviewCount > 0 && (
                                  <span className="text-secondary-500">
                                    ({p.reviewCount})
                                  </span>
                                )}
                              </span>
                              {typeof distance === "number" && (
                                <span className="text-secondary-500">
                                  {distance.toFixed(1)} km
                                </span>
                              )}
                            </div>
                            {!hasPin && (
                              <p className="text-[10px] italic text-secondary-500">
                                No exact pin
                              </p>
                            )}
                            <Link
                              href={`/providers/${p.id}`}
                              onClick={(e) => e.stopPropagation()}
                              className="mt-auto text-xs font-semibold text-primary-600 hover:underline"
                            >
                              View profile →
                            </Link>
                          </button>
                        );
                      })}
                      </div>
                    </div>

                    {/* Map header — explicit label so the user knows this big
                        rectangle IS the interactive map. */}
                    <div className="flex flex-wrap items-center justify-between gap-2 rounded-t-2xl border-2 border-b-0 border-gray-200 bg-white px-4 py-2">
                      <p className="flex items-center gap-2 text-sm font-bold text-gray-800">
                        <MapIcon className="h-4 w-4 text-primary-600" />
                        Interactive map
                      </p>
                      <p className="text-xs text-secondary-500">
                        {geo
                          ? "Tap a card or pin — driving directions appear once selected."
                          : "Tap a pin or card to see provider details. Enable location for routing."}
                      </p>
                    </div>
                    <div className="-mt-4">
                      <ProvidersMap
                        providers={providers}
                        userLocation={geo}
                        enableRouting={!!geo}
                        numbered
                        selectedProviderId={selectedMapId}
                        onProviderSelect={setSelectedMapId}
                      />
                    </div>
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
            <h3 className="font-sans text-lg font-bold text-gray-900 md:text-xl">
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
                <h3 className="font-sans text-xl font-bold text-gray-900">
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

              {/* Service category — mobile */}
              <FilterGroup label="Service category">
                <div className="max-h-48 overflow-y-auto space-y-2 pr-1">
                  <RadioRow
                    active={selectedCategory === "all"}
                    onClick={() => {
                      handleCategoryChange("all");
                      setShowMobileFilters(false);
                    }}
                    name="m-category"
                  >
                    All Services
                  </RadioRow>
                  {categories.map((c) => {
                    const Icon = categoryIcons[c.slug] ?? Wrench;
                    const s = c.slug || c.id;
                    return (
                      <RadioRow
                        key={c.id}
                        active={
                          selectedCategory === s || selectedCategory === c.id
                        }
                        onClick={() => {
                          handleCategoryChange(s);
                          setShowMobileFilters(false);
                        }}
                        name="m-category"
                      >
                        <Icon
                          className="h-4 w-4 text-primary-500"
                          strokeWidth={2}
                        />
                        {c.name}
                      </RadioRow>
                    );
                  })}
                </div>
              </FilterGroup>

              <FilterGroup label="Sort by">
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as SortBy)}
                  className="w-full rounded-xl border-2 border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                >
                  <option value="relevance">Most relevant</option>
                  <option value="rating">Highest rated</option>
                  <option value="reviews">Most reviewed</option>
                  <option value="distance" disabled={!geo}>
                    Nearest {geo ? "" : "(turn on location)"}
                  </option>
                  <option value="newest">Newest</option>
                  <option value="priceLow">Price: low to high</option>
                  <option value="priceHigh">Price: high to low</option>
                </select>
              </FilterGroup>

              <GeoRadiusGroup
                geo={geo}
                geoStatus={geoStatus}
                radiusKm={radiusKm}
                onRequest={requestGeolocation}
                onClear={clearGeo}
                onRadiusChange={setRadiusKm}
              />

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
      <Card className="h-full border-2 border-transparent transition-all hover:-translate-y-1 hover:border-primary-300 hover:shadow-lg">
        {/* Provider image */}
        {provider.user.profileImage && (
          <div className="relative h-36 w-full overflow-hidden rounded-t-2xl bg-gray-100">
            <Image
              src={provider.user.profileImage}
              alt={provider.user.name}
              fill
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 300px"
              className="object-cover"
            />
          </div>
        )}

        <div className="p-4">
          {/* Name + verification */}
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <h3 className="text-base font-bold text-gray-900">
              {provider.user.name}
            </h3>
            {verified && (
              <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-bold text-blue-700 ring-1 ring-blue-200">
                <CheckCircle className="h-3 w-3 fill-blue-500 text-white" />
                Verified
              </span>
            )}
          </div>

          {/* Primary category */}
          <p className="text-sm font-medium capitalize text-primary-600">
            {primaryCategory?.name ?? "Service provider"}
          </p>

          {/* All categories — color-tinted so multi-service providers are
              visually distinguishable at a glance. */}
          {provider.categories.length > 1 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {provider.categories.map((pc) => {
                const accent = pc.category.color || "#3B82F6";
                return (
                  <span
                    key={pc.id}
                    className={cn(
                      "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold",
                      pc.isPrimary ? "ring-1 ring-current" : "border-transparent",
                    )}
                    style={{
                      color: accent,
                      backgroundColor: `${accent}1A`,
                      borderColor: pc.isPrimary ? accent : "transparent",
                    }}
                  >
                    <span
                      aria-hidden
                      className="h-1.5 w-1.5 rounded-full"
                      style={{ backgroundColor: accent }}
                    />
                    {pc.category.name}
                    {pc.isPrimary && (
                      <span className="text-[9px] font-bold uppercase opacity-70">
                        Main
                      </span>
                    )}
                  </span>
                );
              })}
            </div>
          )}

          {/* Rating + location */}
          <div className="mt-3 flex items-center gap-3 text-sm text-gray-600">
            <div className="flex items-center gap-1">
              <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
              <span className="font-bold text-gray-900">
                {Number(provider.rating).toFixed(1)}
              </span>
              <span className="text-gray-500">({provider.reviewCount})</span>
            </div>
            <span className="text-gray-300">·</span>
            <div className="flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5 text-primary-500" />
              <span>{provider.location}</span>
            </div>
          </div>

          {/* Bio / About description */}
          {(provider.bio || provider.specialties?.length) && (
            <p className="mt-3 text-sm leading-relaxed text-gray-600">
              {provider.bio ||
                provider.specialties?.map((s) => s.specialty).join(" · ") ||
                ""}
            </p>
          )}

          {/* Experience */}
          <div className="mt-3 flex items-center gap-1 text-xs text-gray-500">
            <Clock className="h-3.5 w-3.5" />
            {provider.yearsExperience}+ years experience
          </div>

          {provider.featured && (
            <Badge variant="warning" className="mt-3 gap-1">
              <Clock className="h-3 w-3" />
              Fast response
            </Badge>
          )}

          <div className="mt-4 border-t border-gray-100 pt-3">
            <Button variant="outline" className="w-full border-primary-200 text-primary-700 hover:bg-primary-50 hover:text-primary-800">View &amp; Book</Button>
          </div>
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
        "inline-flex min-h-[44px] items-center gap-1.5 whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2",
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
      <label className="mb-3 block text-base font-semibold text-gray-700">
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
        "flex cursor-pointer items-center gap-3 rounded-lg border p-4 transition-colors min-h-[48px]",
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
      <span className="flex flex-1 items-center gap-2 text-base font-medium text-gray-900">
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
        "inline-flex min-h-[44px] items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-colors",
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
      className="inline-flex min-h-[44px] items-center gap-2 rounded-full bg-gray-100 px-4 py-2 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-200"
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
      <p className="font-sans text-2xl font-bold">{value}</p>
      <p className="mt-1 text-sm font-semibold opacity-80">{label}</p>
    </div>
  );
}

function GeoRadiusGroup({
  geo,
  geoStatus,
  radiusKm,
  onRequest,
  onClear,
  onRadiusChange,
}: {
  geo: { lat: number; lng: number } | null;
  geoStatus:
    | "idle"
    | "locating"
    | "ready"
    | "denied"
    | "unavailable"
    | "timeout"
    | "unsupported";
  radiusKm: number;
  onRequest: () => void;
  onClear: () => void;
  onRadiusChange: (value: number) => void;
}) {
  return (
    <FilterGroup label="Near me">
      {geo ? (
        <div className="space-y-3 rounded-xl border border-primary-100 bg-primary-50 p-3">
          <div className="flex items-center justify-between gap-2 text-xs font-bold text-primary-700">
            <span className="flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5" />
              Using your location
            </span>
            <button
              type="button"
              onClick={onClear}
              className="text-primary-600 underline-offset-4 hover:underline"
            >
              Turn off
            </button>
          </div>
          <div>
            <label className="flex items-center justify-between text-xs font-semibold text-gray-700">
              <span>Radius</span>
              <span className="text-primary-700">{radiusKm} km</span>
            </label>
            <input
              type="range"
              min={1}
              max={100}
              step={1}
              value={radiusKm}
              onChange={(e) => onRadiusChange(Number(e.target.value))}
              className="mt-1.5 w-full accent-primary-500"
              aria-label="Search radius in kilometers"
            />
            <div className="mt-1 flex justify-between text-[10px] font-semibold text-gray-500">
              <span>1km</span>
              <span>25km</span>
              <span>50km</span>
              <span>100km</span>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <button
            type="button"
            onClick={onRequest}
            disabled={geoStatus === "locating" || geoStatus === "unsupported"}
            className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gray-200 bg-white px-4 py-3 text-sm font-bold text-gray-700 transition-colors hover:border-primary-300 hover:bg-primary-50 hover:text-primary-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <MapPin className="h-4 w-4" />
            {geoStatus === "locating"
              ? "Locating…"
              : geoStatus === "denied"
                ? "Permission blocked — retry"
                : geoStatus === "timeout"
                  ? "Took too long — retry"
                  : geoStatus === "unavailable"
                    ? "No location signal — retry"
                    : geoStatus === "unsupported"
                      ? "Location unavailable"
                      : "Use my location"}
          </button>
          {(geoStatus === "denied" ||
            geoStatus === "unavailable" ||
            geoStatus === "timeout" ||
            geoStatus === "unsupported") && (
            <p className="text-[11px] leading-snug text-gray-500">
              {geoStatus === "denied"
                ? "You blocked location access for this site. In the browser's address bar, click the lock icon → Site settings → Location → Allow, then retry."
                : geoStatus === "unavailable"
                  ? "Your device couldn't determine its location. On Windows make sure Settings → Privacy → Location is on; on a desktop without GPS, try a phone or connect to Wi-Fi for a rough fix."
                  : geoStatus === "timeout"
                    ? "The lookup timed out. Check your network and try again."
                    : "This page must be on HTTPS for geolocation to work."}
            </p>
          )}
        </div>
      )}
    </FilterGroup>
  );
}

function SearchPageSkeleton() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="text-sm font-semibold text-gray-500">Loading…</div>
    </div>
  );
}
