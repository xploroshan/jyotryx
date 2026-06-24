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

// next/og (Satori) renders ONLY glyphs from fonts we pass; its bundled default
// covers Latin alone. This app's share names/verdicts can be in any of 11 Indic
// scripts, which would otherwise render as blank "tofu" boxes. For a non-Latin
// share we fetch a subsetted TTF for the matching script (plus Latin for the
// digits/brand) from Google Fonts. Best-effort throughout: any failure returns
// undefined and we fall back to Satori's built-in Latin default — no regression.
const NOTO_INDIC: Record<string, string> = {
  hi: "Noto Sans Devanagari",
  mr: "Noto Sans Devanagari",
  bn: "Noto Sans Bengali",
  as: "Noto Sans Bengali",
  ta: "Noto Sans Tamil",
  te: "Noto Sans Telugu",
  kn: "Noto Sans Kannada",
  ml: "Noto Sans Malayalam",
  gu: "Noto Sans Gujarati",
  pa: "Noto Sans Gurmukhi",
  or: "Noto Sans Oriya",
};

async function loadFont(family: string, text: string): Promise<ArrayBuffer | null> {
  try {
    const url = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}&text=${encodeURIComponent(text)}`;
    // An old UA makes Google serve TTF (Satori cannot read woff2).
    const css = await (
      await fetch(url, { headers: { "User-Agent": "Mozilla/4.0 (compatible; MSIE 6.0; Windows NT 5.1)" } })
    ).text();
    const match = css.match(/src:\s*url\((https:\/\/[^)]+\.(?:ttf|otf))\)/i);
    if (!match) return null;
    const res = await fetch(match[1]);
    if (!res.ok) return null;
    return await res.arrayBuffer();
  } catch {
    return null;
  }
}

type OgFont = { name: string; data: ArrayBuffer; style: "normal"; weight: 400 };

async function buildFonts(locale: string | null | undefined, text: string): Promise<OgFont[] | undefined> {
  const indicFamily = locale ? NOTO_INDIC[locale] : undefined;
  if (!indicFamily) return undefined; // Latin share → Satori's default is fine.
  // Latin is needed too: once we pass any custom font, Satori ignores its
  // built-in default, so digits/"%"/"myastro360" would otherwise vanish.
  const latin = await loadFont("Noto Sans", `${text} 0123456789%&·/ myastro360`);
  if (!latin) return undefined; // couldn't get Latin → don't risk breaking it.
  const fonts: OgFont[] = [{ name: "og", data: latin, style: "normal", weight: 400 }];
  const indic = await loadFont(indicFamily, text);
  if (indic) fonts.push({ name: "og", data: indic, style: "normal", weight: 400 });
  return fonts;
}

export async function GET(_req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const data = await fetchSharedMatch(token);

  const accent =
    !data ? "#ff7a1a" : data.percentage >= 75 ? "#34d399" : data.percentage >= 50 ? "#ff7a1a" : "#f87171";

  const fonts = data
    ? await buildFonts(data.locale, `${data.personAName} ${data.personBName} ${data.compatibility}`)
    : undefined;
  const fontFamily = fonts ? '"og", sans-serif' : "sans-serif";

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
          fontFamily,
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
    { ...SIZE, fonts },
  );
}
