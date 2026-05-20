"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
} from "react";
import { MapPin, Search, X, Navigation } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

export interface PickedLocation {
  /** Display name we save on the provider profile. */
  label: string;
  lat: number;
  lng: number;
}

interface LocationPickerProps {
  /** Currently selected display string — empty until first pick. */
  value: string;
  onSelect: (loc: PickedLocation) => void;
  /** Clear selection (back to empty). */
  onClear?: () => void;
  /** Optional: include a "Use my location" auto-detect button. */
  showDetect?: boolean;
  /** Triggered when the user clicks the auto-detect button. */
  onDetect?: () => void;
  detecting?: boolean;
  /** Visual error binding (e.g. zod validation). */
  error?: string;
  placeholder?: string;
}

/**
 * Mapbox Geocoding API v6 feature shape — narrowed to the fields we read.
 * See https://docs.mapbox.com/api/search/geocoding/#geocoding-response-object
 */
interface MapboxFeature {
  id: string;
  type: "Feature";
  geometry: { type: "Point"; coordinates: [number, number] };
  properties: {
    name?: string;
    name_preferred?: string;
    full_address?: string;
    place_formatted?: string;
    feature_type?: string;
    context?: Record<
      string,
      { name?: string; region?: string; country_code?: string } | undefined
    >;
  };
}

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

/**
 * Searchable, Ghana-wide location picker backed by the Mapbox Geocoding API.
 *
 * - Debounced (350 ms) live search restricted to `country=gh` so we don't
 *   surface "Accra, Indonesia" by mistake.
 * - Returns a clean display label + lat/lng so we can pin the provider on
 *   the customer-facing map and run radius search.
 * - Gracefully degrades to a freeform text input when NEXT_PUBLIC_MAPBOX_TOKEN
 *   is missing — picker still works for typed labels, just without suggestions.
 */
export function LocationPicker({
  value,
  onSelect,
  onClear,
  showDetect,
  onDetect,
  detecting,
  error,
  placeholder = "Search any town or area in Ghana…",
}: LocationPickerProps) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<MapboxFeature[]>([]);
  const [loading, setLoading] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Close on outside click.
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("mousedown", handler);
    return () => window.removeEventListener("mousedown", handler);
  }, [open]);

  // Debounced Mapbox forward-geocode. The `proximity=ip` bias surfaces nearer
  // matches first; `country=gh` hard-restricts the result set.
  useEffect(() => {
    if (!MAPBOX_TOKEN) return;
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    const t = setTimeout(async () => {
      try {
        const url =
          `https://api.mapbox.com/search/geocode/v6/forward?` +
          `q=${encodeURIComponent(trimmed)}` +
          `&country=gh&proximity=ip&limit=8&language=en` +
          `&access_token=${MAPBOX_TOKEN}`;
        const res = await fetch(url, {
          signal: ctrl.signal,
          headers: { Accept: "application/json" },
        });
        if (!res.ok) throw new Error(`Mapbox ${res.status}`);
        const data: { features?: MapboxFeature[] } = await res.json();
        setResults(data.features ?? []);
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          setResults([]);
        }
      } finally {
        setLoading(false);
      }
    }, 350);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [query]);

  // Build a tidy label from Mapbox's context pieces. Prefers locality/region
  // when present; falls back to the full address.
  const labelFor = (f: MapboxFeature): string => {
    const p = f.properties;
    const ctx = p.context || {};
    const place =
      p.name ||
      p.name_preferred ||
      ctx.neighborhood?.name ||
      ctx.locality?.name ||
      ctx.place?.name ||
      null;
    const region = ctx.region?.name || null;
    if (place && region && place !== region) return `${place}, ${region}`;
    if (place) return place;
    return p.full_address || p.place_formatted || "Unnamed location";
  };

  const sublabelFor = (f: MapboxFeature): string =>
    f.properties.full_address || f.properties.place_formatted || "";

  // Hide repeats — Mapbox can return overlapping street/neighbourhood pins
  // with the same human label.
  const uniqueResults = useMemo(() => {
    const seen = new Set<string>();
    return results.filter((r) => {
      const key = labelFor(r);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [results]);

  const handlePick = (f: MapboxFeature) => {
    const label = labelFor(f);
    const [lng, lat] = f.geometry.coordinates;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
    onSelect({ label, lat, lng });
    setOpen(false);
    setQuery("");
    setResults([]);
  };

  return (
    <div className="relative" ref={wrapRef}>
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          {value && !open ? (
            <button
              type="button"
              onClick={() => setOpen(true)}
              className={cn(
                "flex w-full items-center justify-between rounded-xl border-2 bg-white py-3 pl-10 pr-3 text-left text-sm font-medium text-gray-900 transition-colors hover:border-primary-300",
                error ? "border-red-400" : "border-gray-200",
              )}
            >
              <span className="truncate">{value}</span>
              {onClear && (
                <span
                  role="button"
                  tabIndex={0}
                  aria-label="Clear location"
                  onClick={(e) => {
                    e.stopPropagation();
                    onClear();
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      e.stopPropagation();
                      onClear();
                    }
                  }}
                  className="ml-2 inline-flex h-6 w-6 cursor-pointer items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                >
                  <X className="h-3.5 w-3.5" />
                </span>
              )}
            </button>
          ) : (
            <input
              type="text"
              autoFocus={open}
              value={query}
              onChange={(e: ChangeEvent<HTMLInputElement>) =>
                setQuery(e.target.value)
              }
              onFocus={() => setOpen(true)}
              placeholder={placeholder}
              className={cn(
                "w-full rounded-xl border-2 bg-white py-3 pl-10 pr-9 text-sm text-gray-900 placeholder-gray-400 transition-colors focus:border-primary-500 focus:outline-none",
                error ? "border-red-400" : "border-gray-200",
              )}
            />
          )}
          {open && !value && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
              {loading ? <Spinner size="sm" /> : <Search className="h-4 w-4" />}
            </span>
          )}
        </div>
        {showDetect && onDetect && (
          <button
            type="button"
            onClick={onDetect}
            disabled={detecting}
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border-2 border-primary-200 bg-primary-50 px-4 py-3 text-sm font-semibold text-primary-700 transition-colors hover:border-primary-400 hover:bg-primary-100 disabled:opacity-60"
          >
            {detecting ? (
              <Spinner size="sm" />
            ) : (
              <Navigation className="h-4 w-4" />
            )}
            {detecting ? "Detecting…" : "Use my location"}
          </button>
        )}
      </div>

      {/* Suggestions dropdown */}
      {open && !value && (
        <div className="absolute left-0 right-0 z-20 mt-1 max-h-64 overflow-y-auto rounded-xl border-2 border-gray-200 bg-white shadow-lg">
          {!MAPBOX_TOKEN ? (
            <p className="px-4 py-3 text-xs text-amber-700 dark:text-amber-200">
              Mapbox token missing — suggestions disabled. Set{" "}
              <code className="rounded bg-amber-50 px-1 dark:bg-amber-900/40">
                NEXT_PUBLIC_MAPBOX_TOKEN
              </code>{" "}
              to enable.
            </p>
          ) : query.trim().length < 2 ? (
            <p className="px-4 py-3 text-xs text-gray-500">
              Type at least 2 characters — e.g. &ldquo;Tarkwa&rdquo;,
              &ldquo;Kasoa&rdquo;, &ldquo;Kumasi&rdquo;.
            </p>
          ) : loading ? (
            <p className="flex items-center gap-2 px-4 py-3 text-xs text-gray-500">
              <Spinner size="sm" /> Searching Ghana…
            </p>
          ) : uniqueResults.length === 0 ? (
            <p className="px-4 py-3 text-xs text-gray-500">
              No matches. Try a nearby town or be more specific.
            </p>
          ) : (
            <ul>
              {uniqueResults.map((r) => (
                <li key={r.id}>
                  <button
                    type="button"
                    onClick={() => handlePick(r)}
                    className="flex w-full items-start gap-2 px-4 py-2 text-left text-sm transition-colors hover:bg-primary-50"
                  >
                    <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary-500" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-gray-900">
                        {labelFor(r)}
                      </p>
                      <p className="truncate text-xs text-gray-500">
                        {sublabelFor(r)}
                      </p>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <p className="border-t border-gray-100 px-4 py-2 text-[10px] text-gray-400">
            Results from{" "}
            <a
              href="https://www.mapbox.com/about/maps/"
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
            >
              Mapbox
            </a>
          </p>
        </div>
      )}

      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
