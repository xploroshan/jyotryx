import { ImageResponse } from "next/og";
import { fetchSharedMatch } from "@/lib/seo/server-api";

/**
 * Per-share Open Graph card for a Kundli-match link. Served as a plain route
 * (not the `opengraph-image` file convention) so the metadata helper can
 * reference it explicitly for both OG and Twitter — matching the brand `/og`
 * route's approach. System font stack only, so generation never needs the
 * network. Falls back to a generic brand card when the token is unknown.
 */
export const runtime = "nodejs";

const SIZE = { width: 1200, height: 630 };

export async function GET(_req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const data = await fetchSharedMatch(token);

  const accent =
    !data ? "#ff7a1a" : data.percentage >= 75 ? "#34d399" : data.percentage >= 50 ? "#ff7a1a" : "#f87171";

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
          padding: "60px",
        }}
      >
        <div
          style={{
            fontSize: 28,
            color: "#d9c9a6",
            display: "flex",
            marginBottom: 12,
            letterSpacing: 4,
            textTransform: "uppercase",
          }}
        >
          Kundli Compatibility
        </div>

        {data ? (
          <>
            <div
              style={{
                fontSize: 60,
                fontWeight: 800,
                display: "flex",
                textAlign: "center",
                maxWidth: 1040,
                letterSpacing: -1,
              }}
            >
              {`${data.personAName}  &  ${data.personBName}`}
            </div>
            <div
              style={{ fontSize: 150, fontWeight: 800, color: accent, display: "flex", lineHeight: 1.1, marginTop: 18 }}
            >
              {`${data.percentage}%`}
            </div>
            <div style={{ fontSize: 38, color: "#f5ecd8", display: "flex", marginTop: 4 }}>
              {`${data.compatibility} · ${data.totalScore}/${data.maxScore} guna`}
            </div>
          </>
        ) : (
          <div style={{ fontSize: 56, fontWeight: 700, display: "flex", marginTop: 12 }}>
            Ashtakoota Guna Milan
          </div>
        )}

        <div style={{ marginTop: 48, fontSize: 32, display: "flex" }}>
          <span style={{ color: "#f5ecd8" }}>myastro</span>
          <span style={{ color: "#ff7a1a" }}>360</span>
        </div>
      </div>
    ),
    SIZE,
  );
}
