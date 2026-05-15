"use client";

import dynamic from "next/dynamic";
import { useMemo } from "react";
import type { Provider } from "@/types";
import type { MapProvider } from "./interactive-map";

// Leaflet touches `window` on import, so the actual map is client-only.
const InteractiveMap = dynamic(() => import("./interactive-map"), {
  ssr: false,
  loading: () => (
    <div className="h-[480px] animate-pulse rounded-2xl border-2 border-gray-100 bg-gray-100" />
  ),
});

interface ProvidersMapProps {
  providers: Provider[];
  userLocation?: { lat: number; lng: number } | null;
  enableRouting?: boolean;
  height?: string;
  linkProviderProfile?: boolean;
}

/**
 * Interactive map view. Plots providers' lat/lng on OpenStreetMap tiles via
 * react-leaflet. When `userLocation` + a single provider is supplied, also
 * draws a driving route (OSRM public demo) and shows distance + ETA.
 */
export function ProvidersMap({
  providers,
  userLocation,
  enableRouting,
  height,
  linkProviderProfile,
}: ProvidersMapProps) {
  const points: MapProvider[] = useMemo(
    () =>
      providers
        .filter(
          (p): p is Provider & { latitude: number; longitude: number } =>
            typeof p.latitude === "number" && typeof p.longitude === "number",
        )
        .map((p) => ({
          id: p.id,
          name: p.user?.name ?? "Provider",
          latitude: p.latitude,
          longitude: p.longitude,
          profileImage: p.user?.profileImage,
          rating: p.rating,
          location: p.location,
        })),
    [providers],
  );

  return (
    <InteractiveMap
      providers={points}
      userLocation={userLocation ?? null}
      enableRouting={enableRouting}
      height={height}
      linkProviderProfile={linkProviderProfile}
    />
  );
}
