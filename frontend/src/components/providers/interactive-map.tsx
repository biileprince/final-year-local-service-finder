"use client";

import { useEffect, useMemo, useState } from "react";
import {
  MapContainer,
  Marker,
  Popup,
  TileLayer,
  Polyline,
  useMap,
} from "react-leaflet";
import L, { type LatLngExpression, type LatLngBoundsExpression } from "leaflet";
import "leaflet/dist/leaflet.css";
import Link from "next/link";
import { Star } from "lucide-react";

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
  /** When true and userLocation+single provider is set, request a route from OSRM. */
  enableRouting?: boolean;
  height?: string;
  /** Render provider name as a link to /providers/:id. Off in dashboards. */
  linkProviderProfile?: boolean;
}

interface RouteInfo {
  coords: [number, number][];
  distanceKm: number;
  durationMin: number;
}

// Leaflet's default icon URLs are broken in bundlers (they reference relative
// paths from the CSS). Re-point them to the CDN so markers actually render.
const DEFAULT_ICON = L.icon({
  iconUrl:
    "https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl:
    "https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl:
    "https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

const USER_ICON = L.divIcon({
  className: "lsf-user-marker",
  html: `<div style="
    width:18px;height:18px;border-radius:9999px;
    background:#2563eb;border:3px solid #fff;
    box-shadow:0 0 0 2px #2563eb55, 0 2px 6px rgba(0,0,0,.25);
  "></div>`,
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});

function FitBounds({
  bounds,
}: {
  bounds: LatLngBoundsExpression | null;
}) {
  const map = useMap();
  useEffect(() => {
    if (!bounds) return;
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
  }, [bounds, map]);
  return null;
}

export default function InteractiveMap({
  providers,
  userLocation,
  enableRouting = false,
  height = "480px",
  linkProviderProfile = true,
}: InteractiveMapProps) {
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

  const bounds = useMemo<LatLngBoundsExpression | null>(() => {
    const coords: [number, number][] = points.map((p) => [
      p.latitude,
      p.longitude,
    ]);
    if (userLocation) coords.push([userLocation.lat, userLocation.lng]);
    if (coords.length === 0) return null;
    if (coords.length === 1) {
      const [lat, lng] = coords[0]!;
      // Pad a single point into a small bounding box so fitBounds doesn't
      // zoom to max.
      return [
        [lat - 0.01, lng - 0.01],
        [lat + 0.01, lng + 0.01],
      ];
    }
    return coords as LatLngExpression[] as LatLngBoundsExpression;
  }, [points, userLocation]);

  // Routing — only when there is a single target and we have a user location.
  const [route, setRoute] = useState<RouteInfo | null>(null);
  const [routeError, setRouteError] = useState<string | null>(null);
  const [routeLoading, setRouteLoading] = useState(false);
  const target = points.length === 1 ? points[0]! : null;

  useEffect(() => {
    if (!enableRouting || !userLocation || !target) {
      setRoute(null);
      return;
    }
    let cancelled = false;
    setRouteLoading(true);
    setRouteError(null);
    const url =
      `https://router.project-osrm.org/route/v1/driving/` +
      `${userLocation.lng},${userLocation.lat};${target.longitude},${target.latitude}` +
      `?overview=full&geometries=geojson`;
    fetch(url)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        const r = data?.routes?.[0];
        if (!r) {
          setRouteError("No route found");
          setRoute(null);
          return;
        }
        const coords: [number, number][] = (
          r.geometry?.coordinates as [number, number][] | undefined
        )?.map(([lng, lat]) => [lat, lng]) ?? [];
        setRoute({
          coords,
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

  if (points.length === 0 && !userLocation) {
    return (
      <div className="rounded-2xl border-2 border-dashed border-gray-200 bg-gray-50 p-12 text-center">
        <p className="text-sm font-semibold text-gray-700">
          No location data available for this view.
        </p>
      </div>
    );
  }

  const center: LatLngExpression = userLocation
    ? [userLocation.lat, userLocation.lng]
    : [points[0]!.latitude, points[0]!.longitude];

  return (
    <div className="relative overflow-hidden rounded-2xl border-2 border-gray-100 shadow-sm">
      <MapContainer
        center={center}
        zoom={13}
        scrollWheelZoom
        style={{ height, width: "100%" }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <FitBounds bounds={bounds} />

        {userLocation && (
          <Marker
            position={[userLocation.lat, userLocation.lng]}
            icon={USER_ICON}
          >
            <Popup>You are here</Popup>
          </Marker>
        )}

        {points.map((p) => (
          <Marker
            key={p.id}
            position={[p.latitude, p.longitude]}
            icon={DEFAULT_ICON}
          >
            <Popup>
              <div className="min-w-[160px]">
                {linkProviderProfile ? (
                  <Link
                    href={`/providers/${p.id}`}
                    className="text-sm font-semibold text-primary-700 hover:underline"
                  >
                    {p.name}
                  </Link>
                ) : (
                  <p className="text-sm font-semibold text-secondary-900">
                    {p.name}
                  </p>
                )}
                {p.location && (
                  <p className="mt-0.5 text-xs text-secondary-500">
                    {p.location}
                  </p>
                )}
                {typeof p.rating === "number" && p.rating > 0 && (
                  <p className="mt-1 flex items-center gap-1 text-xs text-amber-600">
                    <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                    {p.rating.toFixed(1)}
                  </p>
                )}
              </div>
            </Popup>
          </Marker>
        ))}

        {route && (
          <Polyline
            positions={route.coords}
            pathOptions={{ color: "#2563eb", weight: 5, opacity: 0.85 }}
          />
        )}
      </MapContainer>

      {(route || routeLoading || routeError) && (
        <div className="absolute left-3 top-3 z-[1000] rounded-xl bg-white/95 px-3 py-2 text-xs shadow-md backdrop-blur">
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
