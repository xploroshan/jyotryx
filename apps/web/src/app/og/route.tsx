import { ImageResponse } from "next/og";

/**
 * Brand Open Graph / social card, served as a normal route at `/og`.
 *
 * Deliberately NOT the file-convention `opengraph-image.tsx`: that special
 * file only attaches to its own route segment and does not cascade to
 * nested routes (so `/numerology`, `/kundli`, … would silently lack a
 * card). Serving it as a plain route and referencing it from the metadata
 * helper + root layout means every page inherits the same image — with no
 * duplicate tags.
 *
 * System font stack only, so generation never needs outbound network.
 */
export const runtime = "nodejs";

const SIZE = { width: 1200, height: 630 };

export function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #1a1206 0%, #2e1d0a 55%, #0d0904 100%)",
          color: "#f5ecd8",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ fontSize: 84, fontWeight: 800, letterSpacing: -2, display: "flex" }}>
          <span style={{ color: "#f5ecd8" }}>myastro</span>
          <span style={{ color: "#ff7a1a" }}>360</span>
        </div>
        <div style={{ marginTop: 24, fontSize: 36, color: "#d9c9a6", display: "flex" }}>
          Vedic Astrology · Kundli · Horoscope · Palmistry
        </div>
        <div style={{ marginTop: 40, fontSize: 24, color: "#9a8a6a", display: "flex" }}>
          Personalized guidance, available 24/7
        </div>
      </div>
    ),
    SIZE,
  );
}
