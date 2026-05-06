"use client";

import { useMemo } from "react";
import Link from "next/link";
import { MapPin } from "lucide-react";
import type { Provider } from "@/types";

interface ProvidersMapProps {
  providers: Provider[];
}

/**
 * Lightweight map view — plots providers' lat/lng on an OpenStreetMap embed,
 * with absolutely-positioned pins overlaid by linear projection within the
 * bounding box. The basemap is static (no pan/zoom) but the pins are
 * clickable and link to each provider's profile.
 */
export function ProvidersMap({ providers }: ProvidersMapProps) {
  const points = useMemo(
    () =>
      providers.filter(
        (p): p is Provider & { latitude: number; longitude: number } =>
          typeof p.latitude === "number" && typeof p.longitude === "number",
      ),
    [providers],
  );

  if (points.length === 0) {
    return (
      <div className="rounded-2xl border-2 border-dashed border-gray-200 bg-gray-50 p-12 text-center">
        <MapPin className="mx-auto h-10 w-10 text-gray-300" />
        <p className="mt-3 text-sm font-semibold text-gray-700">
          No providers with location data in this view.
        </p>
        <p className="mt-1 text-xs text-gray-500">
          Try widening your filters or switch back to grid view.
        </p>
      </div>
    );
  }

  const lats = points.map((p) => p.latitude);
  const lngs = points.map((p) => p.longitude);
  let minLat = Math.min(...lats);
  let maxLat = Math.max(...lats);
  let minLng = Math.min(...lngs);
  let maxLng = Math.max(...lngs);

  // Pad the bbox so pins aren't on the edge.
  const latPad = Math.max((maxLat - minLat) * 0.2, 0.01);
  const lngPad = Math.max((maxLng - minLng) * 0.2, 0.01);
  minLat -= latPad;
  maxLat += latPad;
  minLng -= lngPad;
  maxLng += lngPad;

  const bbox = `${minLng},${minLat},${maxLng},${maxLat}`;
  const mapSrc = `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik`;

  const project = (lat: number, lng: number) => {
    const x = ((lng - minLng) / (maxLng - minLng)) * 100;
    // Latitude grows north → flip y so north is up
    const y = (1 - (lat - minLat) / (maxLat - minLat)) * 100;
    return { x, y };
  };

  return (
    <div className="relative overflow-hidden rounded-2xl border-2 border-gray-100 shadow-sm">
      <iframe
        src={mapSrc}
        title="Providers map"
        className="h-[480px] w-full"
        loading="lazy"
      />
      <div className="pointer-events-none absolute inset-0">
        {points.map((p) => {
          const { x, y } = project(p.latitude, p.longitude);
          return (
            <Link
              key={p.id}
              href={`/providers/${p.id}`}
              style={{ left: `${x}%`, top: `${y}%` }}
              className="pointer-events-auto absolute -translate-x-1/2 -translate-y-full"
              title={p.user?.name || "Provider"}
            >
              <div className="flex flex-col items-center">
                <div className="rounded-full bg-primary-600 px-2.5 py-1 text-xs font-bold text-white shadow-lg ring-2 ring-white">
                  {p.user?.name?.split(" ")[0] || "Provider"}
                </div>
                <div className="-mt-0.5 h-3 w-3 rotate-45 bg-primary-600 ring-2 ring-white" />
              </div>
            </Link>
          );
        })}
      </div>
      <p className="border-t bg-gray-50 px-4 py-2 text-xs text-gray-500">
        Showing {points.length} provider{points.length === 1 ? "" : "s"} on the
        map. Drag-to-pan is disabled — click a pin to open a profile.
      </p>
    </div>
  );
}
