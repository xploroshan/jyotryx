import { ImageResponse } from "next/og";
import { OG_MARK_DATA_URI, GRADIENT_360_STYLE, OG_INK_BG } from "@/lib/brand/og-mark";

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
          background: OG_INK_BG,
          color: "#ece9f6",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={OG_MARK_DATA_URI} width={132} height={132} alt="" />
          <div style={{ fontSize: 84, fontWeight: 800, letterSpacing: -2, display: "flex" }}>
            <span style={{ color: "#f5f3ff" }}>MyAstro</span>
            <span style={GRADIENT_360_STYLE}>360</span>
          </div>
        </div>
        <div style={{ marginTop: 28, fontSize: 36, color: "#c3bce0", display: "flex" }}>
          Vedic Astrology · Kundli · Horoscope · Palmistry
        </div>
        <div style={{ marginTop: 36, fontSize: 24, color: "#8a83b0", display: "flex" }}>
          Personalized guidance, available 24/7
        </div>
      </div>
    ),
    SIZE,
  );
}
