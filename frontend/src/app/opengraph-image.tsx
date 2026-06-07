import { ImageResponse } from "next/og";

export const alt = "Local Service Finder — Find Trusted Service Providers in Ghana";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "80px",
          background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)",
          color: "#ffffff",
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "20px",
            marginBottom: "32px",
          }}
        >
          <div
            style={{
              width: "72px",
              height: "72px",
              borderRadius: "18px",
              background: "#f97316",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "44px",
              fontWeight: 700,
            }}
          >
            LSF
          </div>
          <div style={{ fontSize: "32px", fontWeight: 600, color: "#f97316" }}>
            Local Service Finder
          </div>
        </div>
        <div style={{ fontSize: "64px", fontWeight: 700, lineHeight: 1.1 }}>
          Find trusted service providers in Ghana
        </div>
        <div
          style={{ fontSize: "30px", color: "#cbd5e1", marginTop: "28px" }}
        >
          Book plumbers, electricians, cleaners and more.
        </div>
      </div>
    ),
    { ...size },
  );
}
