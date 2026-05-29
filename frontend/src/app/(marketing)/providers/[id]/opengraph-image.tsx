import { ImageResponse } from "next/og";

export const alt = "Service provider on Local Service Finder";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

interface ProviderLite {
  user?: { name?: string };
  location?: string;
  rating?: number | string;
  reviewCount?: number;
  categories?: { category?: { name?: string } }[];
}

export default async function Image({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  let provider: ProviderLite | null = null;
  try {
    const res = await fetch(`${API_URL}/providers/${id}`, {
      next: { revalidate: 3600 },
    });
    if (res.ok) provider = (await res.json()) as ProviderLite;
  } catch {
    /* fall back to the generic card below */
  }

  const name = provider?.user?.name ?? "Service Provider";
  const category = provider?.categories?.[0]?.category?.name ?? "Local services";
  const location = provider?.location ?? "Ghana";
  const rating = provider?.rating ? Number(provider.rating).toFixed(1) : null;
  const reviewCount = provider?.reviewCount ?? 0;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "80px",
          background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)",
          color: "#ffffff",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <div
            style={{
              width: "56px",
              height: "56px",
              borderRadius: "14px",
              background: "#f97316",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "30px",
              fontWeight: 700,
            }}
          >
            LSF
          </div>
          <div style={{ fontSize: "26px", fontWeight: 600, color: "#f97316" }}>
            Local Service Finder
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: "30px", color: "#f97316", fontWeight: 600 }}>
            {category}
          </div>
          <div
            style={{ fontSize: "68px", fontWeight: 700, lineHeight: 1.05, marginTop: "8px" }}
          >
            {name}
          </div>
          <div
            style={{ fontSize: "30px", color: "#cbd5e1", marginTop: "20px" }}
          >
            {location}
            {rating ? `  ·  ★ ${rating} (${reviewCount})` : ""}
          </div>
        </div>

        <div style={{ fontSize: "26px", color: "#94a3b8" }}>
          Book trusted local pros in Ghana
        </div>
      </div>
    ),
    { ...size },
  );
}
