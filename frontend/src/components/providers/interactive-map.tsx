"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Map, {
  Marker,
  Popup,
  NavigationControl,
  Source,
  Layer,
  type MapRef,
  type LngLatBoundsLike,
} from "react-map-gl/mapbox";
import "mapbox-gl/dist/mapbox-gl.css";
import Link from "next/link";
import { MapPin, Star } from "lucide-react";
import { useTheme } from "@/components/theme/theme-provider";

export interface MapProvider {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  profileImage?: string;
  rating?: number;
  location?: string;
}

interface InteractiveMapProps {
  providers: MapProvider[];
  /** User's current location (origin for routing). */
  userLocation?: { lat: number; lng: number } | null;
  /** When true and userLocation+single provider is set, request a route from Mapbox Directions. */
  enableRouting?: boolean;
  height?: string;
  /** Render provider name as a link to /providers/:id. Off in dashboards. */
  linkProviderProfile?: boolean;
}

interface RouteInfo {
  /** GeoJSON LineString coords ([lng, lat] pairs). */
  geometry: GeoJSON.LineString;
  distanceKm: number;
  durationMin: number;
}

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
const MAP_STYLE_LIGHT = "mapbox://styles/mapbox/streets-v12";
const MAP_STYLE_DARK = "mapbox://styles/mapbox/dark-v11";
// Falls back to Accra so the initial viewport isn't (0,0) when neither
// providers nor a user location are available yet.
const FALLBACK_CENTER = { latitude: 5.6037, longitude: -0.187 };

export default function InteractiveMap({
  providers,
  userLocation,
  enableRouting = false,
  height = "480px",
  linkProviderProfile = true,
}: InteractiveMapProps) {
  const mapRef = useRef<MapRef | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // react-map-gl swaps Mapbox styles on the fly when `mapStyle` changes, so
  // toggling the dashboard theme repaints the tiles without remounting the
  // component (which would lose viewport + selected pin).
  const { resolvedTheme } = useTheme();
  const mapStyle =
    resolvedTheme === "dark" ? MAP_STYLE_DARK : MAP_STYLE_LIGHT;

  const points = useMemo(
    () =>
      providers.filter(
        (p) =>
          typeof p.latitude === "number" &&
          typeof p.longitude === "number" &&
          !Number.isNaN(p.latitude) &&
          !Number.isNaN(p.longitude),
      ),
    [providers],
  );

  const initialView = useMemo(() => {
    if (userLocation) {
      return {
        latitude: userLocation.lat,
        longitude: userLocation.lng,
        zoom: 12,
      };
    }
    if (points[0]) {
      return {
        latitude: points[0].latitude,
        longitude: points[0].longitude,
        zoom: 12,
      };
    }
    return { ...FALLBACK_CENTER, zoom: 7 };
  }, [userLocation, points]);

  // Fit bounds when the set of plotted points changes. We compute bounds
  // imperatively rather than via initialViewState so re-filtering on /search
  // re-frames the map without remounting.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const coords: [number, number][] = points.map((p) => [
      p.longitude,
      p.latitude,
    ]);
    if (userLocation) coords.push([userLocation.lng, userLocation.lat]);
    if (coords.length === 0) return;
    if (coords.length === 1) {
      const [lng, lat] = coords[0]!;
      map.flyTo({ center: [lng, lat], zoom: 13, duration: 600 });
      return;
    }
    let minLng = coords[0]![0];
    let minLat = coords[0]![1];
    let maxLng = coords[0]![0];
    let maxLat = coords[0]![1];
    for (const [lng, lat] of coords) {
      if (lng < minLng) minLng = lng;
      if (lng > maxLng) maxLng = lng;
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
    }
    const bounds: LngLatBoundsLike = [
      [minLng, minLat],
      [maxLng, maxLat],
    ];
    map.fitBounds(bounds, {
      padding: 60,
      maxZoom: 14,
      duration: 600,
    });
  }, [points, userLocation]);

  // Driving directions — only when there is a single target and we have a
  // user location. Mapbox Directions API returns GeoJSON we can hand straight
  // to a <Source>/<Layer>.
  const [route, setRoute] = useState<RouteInfo | null>(null);
  const [routeError, setRouteError] = useState<string | null>(null);
  const [routeLoading, setRouteLoading] = useState(false);
  const target = points.length === 1 ? points[0]! : null;

  useEffect(() => {
    if (!enableRouting || !userLocation || !target || !MAPBOX_TOKEN) {
      setRoute(null);
      return;
    }
    let cancelled = false;
    setRouteLoading(true);
    setRouteError(null);
    const url =
      `https://api.mapbox.com/directions/v5/mapbox/driving/` +
      `${userLocation.lng},${userLocation.lat};${target.longitude},${target.latitude}` +
      `?geometries=geojson&overview=full&access_token=${MAPBOX_TOKEN}`;
    fetch(url)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        const r = data?.routes?.[0];
        if (!r?.geometry) {
          setRouteError("No route found");
          setRoute(null);
          return;
        }
        setRoute({
          geometry: r.geometry,
          distanceKm: r.distance / 1000,
          durationMin: r.duration / 60,
        });
      })
      .catch(() => {
        if (cancelled) return;
        setRouteError("Routing service unavailable");
        setRoute(null);
      })
      .finally(() => {
        if (!cancelled) setRouteLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [enableRouting, userLocation, target]);

  if (!MAPBOX_TOKEN) {
    // Mid-tone foreground utilities (amber-700/-900) aren't remapped in dark
    // mode — only the -50 surface flips. Without an explicit dark override
    // here the heading is dark amber on a dark amber surface, unreadable.
    return (
      <div
        className="flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-amber-200 bg-amber-50 p-12 text-center dark:border-amber-900/40"
        style={{ height }}
      >
        <MapPin className="h-6 w-6 text-amber-500" />
        <p className="text-sm font-semibold text-amber-900 dark:text-amber-100">
          Map unavailable — Mapbox token not configured.
        </p>
        <p className="max-w-md text-xs text-amber-700 dark:text-amber-200">
          Set <code className="rounded bg-white/60 px-1 dark:bg-white/10">NEXT_PUBLIC_MAPBOX_TOKEN</code> in
          your environment to enable the interactive map.
        </p>
      </div>
    );
  }

  if (points.length === 0 && !userLocation) {
    return (
      <div className="rounded-2xl border-2 border-dashed border-gray-200 bg-gray-50 p-12 text-center">
        <p className="text-sm font-semibold text-gray-700">
          No location data available for this view.
        </p>
      </div>
    );
  }

  const selected = points.find((p) => p.id === selectedId) ?? null;

  return (
    <div
      className="relative overflow-hidden rounded-2xl border-2 border-gray-100 shadow-sm"
      style={{ height }}
    >
      <Map
        ref={mapRef}
        mapboxAccessToken={MAPBOX_TOKEN}
        mapStyle={mapStyle}
        initialViewState={initialView}
        style={{ width: "100%", height: "100%" }}
        attributionControl={true}
      >
        <NavigationControl position="top-right" showCompass={false} />

        {userLocation && (
          <Marker
            longitude={userLocation.lng}
            latitude={userLocation.lat}
            anchor="center"
          >
            <div
              aria-label="You are here"
              className="h-[18px] w-[18px] rounded-full border-[3px] border-white bg-primary-600 shadow-[0_0_0_2px_rgba(37,99,235,.33),0_2px_6px_rgba(0,0,0,.25)]"
            />
          </Marker>
        )}

        {points.map((p) => (
          <Marker
            key={p.id}
            longitude={p.longitude}
            latitude={p.latitude}
            anchor="bottom"
            onClick={(e) => {
              // Stop the click bubbling to the map so it doesn't immediately
              // close the popup we're about to open.
              e.originalEvent.stopPropagation();
              setSelectedId(p.id);
            }}
          >
            <button
              type="button"
              aria-label={`View ${p.name}`}
              className="-translate-y-1 transition-transform hover:scale-110"
            >
              <MapPin className="h-7 w-7 fill-primary-600 text-primary-700 drop-shadow-md" />
            </button>
          </Marker>
        ))}

        {selected && (
          <Popup
            longitude={selected.longitude}
            latitude={selected.latitude}
            anchor="top"
            offset={20}
            closeOnClick={false}
            onClose={() => setSelectedId(null)}
            className="lsf-mapbox-popup"
          >
            <div className="min-w-[160px] p-1">
              {linkProviderProfile ? (
                <Link
                  href={`/providers/${selected.id}`}
                  className="text-sm font-semibold text-primary-700 hover:underline"
                >
                  {selected.name}
                </Link>
              ) : (
                <p className="text-sm font-semibold text-secondary-900">
                  {selected.name}
                </p>
              )}
              {selected.location && (
                <p className="mt-0.5 text-xs text-secondary-500">
                  {selected.location}
                </p>
              )}
              {typeof selected.rating === "number" && selected.rating > 0 && (
                <p className="mt-1 flex items-center gap-1 text-xs text-amber-600">
                  <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                  {selected.rating.toFixed(1)}
                </p>
              )}
            </div>
          </Popup>
        )}

        {route && (
          <Source
            id="lsf-route"
            type="geojson"
            data={{
              type: "Feature",
              properties: {},
              geometry: route.geometry,
            }}
          >
            <Layer
              id="lsf-route-line"
              type="line"
              layout={{ "line-cap": "round", "line-join": "round" }}
              paint={{
                "line-color": "#2563eb",
                "line-width": 5,
                "line-opacity": 0.85,
              }}
            />
          </Source>
        )}
      </Map>

      {(route || routeLoading || routeError) && (
        <div className="absolute left-3 top-3 z-10 rounded-xl bg-white/95 px-3 py-2 text-xs shadow-md backdrop-blur">
          {routeLoading && (
            <span className="font-medium text-secondary-600">
              Finding route…
            </span>
          )}
          {routeError && !routeLoading && (
            <span className="font-medium text-error-600">{routeError}</span>
          )}
          {route && !routeLoading && (
            <div className="flex items-center gap-3 font-medium text-secondary-800">
              <span>
                <span className="font-bold text-primary-700">
                  {route.distanceKm.toFixed(1)} km
                </span>{" "}
                away
              </span>
              <span aria-hidden className="text-secondary-300">
                ·
              </span>
              <span>
                <span className="font-bold text-primary-700">
                  {Math.max(1, Math.round(route.durationMin))} min
                </span>{" "}
                by car
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
