"use client";

import dynamic from "next/dynamic";
import { useMemo } from "react";
import type { Provider } from "@/types";
import type { MapProvider } from "./interactive-map";

// Mapbox GL touches `window` on import, so the actual map is client-only.
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
  /** Controlled selection — synced with an external list of result cards. */
  selectedProviderId?: string | null;
  onProviderSelect?: (id: string | null) => void;
  /** When true, each marker shows its 1-based index from `providers` so the map
   *  pins can be cross-referenced with a numbered result list. */
  numbered?: boolean;
  /** Optional customer/destination pin shown as a green home marker. */
  customerPin?: { lat: number; lng: number; label?: string } | null;
}

/**
 * Interactive map view. Plots providers' lat/lng on Mapbox tiles via
 * react-map-gl. When `userLocation` + a single provider is supplied, also
 * draws a driving route (Mapbox Directions API) and shows distance + ETA.
 */
export function ProvidersMap({
  providers,
  userLocation,
  enableRouting,
  height,
  linkProviderProfile,
  selectedProviderId,
  onProviderSelect,
  numbered,
  customerPin,
}: ProvidersMapProps) {
  const points: MapProvider[] = useMemo(
    () => {
      const filtered = providers
        .map((p, originalIdx) => ({ p, originalIdx }))
        .filter(
          (
            x,
          ): x is {
            p: Provider & { latitude: number; longitude: number };
            originalIdx: number;
          } =>
            typeof x.p.latitude === "number" &&
            typeof x.p.longitude === "number",
        );
      return filtered.map(({ p, originalIdx }) => {
        const primaryCategory =
          p.categories.find((c) => c.isPrimary)?.category?.name ??
          p.categories[0]?.category?.name ??
          undefined;
        return {
          id: p.id,
          name: p.user?.name ?? "Provider",
          latitude: p.latitude,
          longitude: p.longitude,
          profileImage: p.user?.profileImage,
          rating: p.rating,
          reviewCount: p.reviewCount,
          location: p.location,
          primaryCategory,
          // 1-based to match the visible card list.
          index: numbered ? originalIdx + 1 : undefined,
        };
      });
    },
    [providers, numbered],
  );

  return (
    <InteractiveMap
      providers={points}
      userLocation={userLocation ?? null}
      enableRouting={enableRouting}
      height={height}
      linkProviderProfile={linkProviderProfile}
      selectedProviderId={selectedProviderId}
      onProviderSelect={onProviderSelect}
      customerPin={customerPin}
    />
  );
}
