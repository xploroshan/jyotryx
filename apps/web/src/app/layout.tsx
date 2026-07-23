import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import {
  Inter,
  Fraunces,
  Noto_Sans_Devanagari,
  Noto_Sans_Bengali,
  Noto_Sans_Tamil,
  Noto_Sans_Telugu,
  Noto_Sans_Gujarati,
  Noto_Sans_Kannada,
  Noto_Sans_Malayalam,
  Noto_Sans_Gurmukhi,
  Noto_Sans_Oriya,
} from "next/font/google";
import "./globals.css";
import Footer from "@/components/layout/Footer";
import ProfileGate from "@/components/auth/ProfileGate";
import RouteFocusReset from "@/components/layout/RouteFocusReset";
import ImpersonateHandler from "@/components/auth/ImpersonateHandler";
import ImpersonationBanner from "@/components/auth/ImpersonationBanner";
import { ConditionalLayoutShell } from "@/components/layout/ConditionalLayoutShell";
import NavbarV2 from "@/components/layout/v2/NavbarV2";
import FeatureBarV2 from "@/components/layout/v2/FeatureBarV2";
import { SITE_ORIGIN } from "@/lib/seo/server-api";
import { jsonLdHtml, organizationLd, websiteLd } from "@/lib/seo/json-ld";
import HtmlLangSync from "@/components/i18n/HtmlLangSync";
import { GoogleAnalytics } from "@/components/analytics/GoogleAnalytics";
import { PostHogAnalytics } from "@/components/analytics/PostHogAnalytics";
import WebVitals from "@/components/analytics/WebVitals";

// Sitewide structured data. The Organization node feeds brand knowledge
// panels and lets answer engines (ChatGPT, Perplexity, Gemini) attribute
// the product correctly; the WebSite node is what Google uses for the
// sitelinks search box. Emitted once in the root layout so every route
// carries it without per-page duplication.
const ORGANIZATION_JSON_LD = {
  ...organizationLd({
    // Real, owner-verified social/app-store profiles only — never placeholders.
    // Add more (X/YouTube/Play Store) here as they go live.
    sameAs: ["https://www.instagram.com/myastro360/"],
  }),
  description:
    "MyAstro360 is a Vedic astrology platform offering instant, personalized Kundli, horoscopes, palmistry, compatibility matching, panchang, and muhurat guidance.",
};

const WEBSITE_JSON_LD = websiteLd();

// We expose the next/font families as their own CSS variables and let the
// theme tokens in globals.css extend them with system fallbacks. Doing it
// this way avoids a recursive `--font-sans: var(--font-sans), …` declaration
// in `@theme`.
// Variable fonts: omitting `weight` makes next/font serve the single
// variable-axis file per family/style instead of one file per weight —
// this page previously preloaded 12 font files (4 Inter + 8 Fraunces),
// which competed with the text-based LCP for bandwidth. Now it's 3
// (Inter var, Fraunces var, Fraunces italic var); every weight 100-900
// remains available.
const sans = Inter({
  subsets: ["latin"],
  variable: "--font-sans-inter",
  display: "swap",
});

const display = Fraunces({
  subsets: ["latin"],
  style: ["normal", "italic"],
  variable: "--font-display-fraunces",
  display: "swap",
});

// Indic webfonts so the 11 non-English languages render consistently on every
// device instead of depending on whatever Indic font the visitor happens to
// have installed (which left scripts like Telugu poorly shaped). Each is
// `preload: false` + carries its own script subset, so a page only downloads
// the one family matching its script (via the @font-face unicode-range) — an
// English page fetches none of them. Chained after Inter/Fraunces in
// globals.css so Latin keeps using the brand fonts.
const notoDeva = Noto_Sans_Devanagari({ subsets: ["devanagari"], weight: ["400", "500", "600", "700"], variable: "--font-noto-deva", display: "swap", preload: false }); // hi, mr
const notoBeng = Noto_Sans_Bengali({ subsets: ["bengali"], weight: ["400", "500", "600", "700"], variable: "--font-noto-beng", display: "swap", preload: false }); // bn, as
const notoTaml = Noto_Sans_Tamil({ subsets: ["tamil"], weight: ["400", "500", "600", "700"], variable: "--font-noto-taml", display: "swap", preload: false });
const notoTelu = Noto_Sans_Telugu({ subsets: ["telugu"], weight: ["400", "500", "600", "700"], variable: "--font-noto-telu", display: "swap", preload: false });
const notoGujr = Noto_Sans_Gujarati({ subsets: ["gujarati"], weight: ["400", "500", "600", "700"], variable: "--font-noto-gujr", display: "swap", preload: false });
const notoKnda = Noto_Sans_Kannada({ subsets: ["kannada"], weight: ["400", "500", "600", "700"], variable: "--font-noto-knda", display: "swap", preload: false });
const notoMlym = Noto_Sans_Malayalam({ subsets: ["malayalam"], weight: ["400", "500", "600", "700"], variable: "--font-noto-mlym", display: "swap", preload: false });
const notoGuru = Noto_Sans_Gurmukhi({ subsets: ["gurmukhi"], weight: ["400", "500", "600", "700"], variable: "--font-noto-guru", display: "swap", preload: false }); // pa
const notoOrya = Noto_Sans_Oriya({ subsets: ["oriya"], weight: ["400", "500", "600", "700"], variable: "--font-noto-orya", display: "swap", preload: false });

const notoVars = [
  notoDeva, notoBeng, notoTaml, notoTelu, notoGujr,
  notoKnda, notoMlym, notoGuru, notoOrya,
].map((f) => f.variable).join(" ");

export const metadata: Metadata = {
  // Brand suffix is applied ONCE here via title.template — page metadata must
  // supply the bare title (no hand-appended " | MyAstro360"). Note: Next
  // applies the template to <title> only, NOT og:title/twitter:title, so
  // pageMetadata() composes the suffixed string for those itself.
  title: {
    default: "MyAstro360 — Vedic Astrology Platform",
    template: "%s | MyAstro360",
  },
  description:
    "Instant, personalized Vedic astrology consultations. Kundli, palmistry, horoscopes, compatibility matching, and spiritual guidance — available 24/7.",
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/favicon.ico", sizes: "any" },
    ],
    apple: "/apple-touch-icon.png",
  },
  manifest: "/manifest.json",
  // NOTE: no `keywords` meta on purpose — it has carried zero ranking weight
  // since ~2009 and only advertises the target list to competitors (SEO
  // audit O5).
  // Same origin source as every canonical/hreflang/sitemap URL (server-api's
  // SITE_ORIGIN) so an env override can never split canonical resolution
  // from og:url/hreflang generation.
  metadataBase: new URL(SITE_ORIGIN),
  // Google Search Console site verification. Set NEXT_PUBLIC_GSC_VERIFICATION
  // in the Vercel env to the token GSC gives you (the value of the
  // `google-site-verification` meta tag) to verify ownership without a code
  // change. Omitted from the <head> when unset. (DNS TXT verification is an
  // alternative and doesn't need this.)
  //
  // SHAPE GUARD: the live site was found serving a Firebase project DOMAIN
  // in this tag (the env var had been set to "jyotron-8a830.firebaseapp.com")
  // — a value Google can never verify. Real GSC tokens are ~43-char
  // URL-safe-base64 strings with no dots; anything else is silently dropped
  // rather than published as a broken verification.
  ...(process.env.NEXT_PUBLIC_GSC_VERIFICATION &&
  /^[A-Za-z0-9_-]{20,100}$/.test(process.env.NEXT_PUBLIC_GSC_VERIFICATION)
    ? { verification: { google: process.env.NEXT_PUBLIC_GSC_VERIFICATION } }
    : {}),
  // NOTE: no `alternates.canonical` here on purpose. A static canonical in
  // the root layout is inherited by every page that doesn't override it,
  // which canonicalises all feature pages to "/". Each page sets its own
  // self-canonical via `pageMetadata()`; pages without one self-canonicalise.
  openGraph: {
    title: "MyAstro360 — Vedic Astrology Platform",
    description: "Instant astrology consultations, palmistry, Kundli, and more.",
    type: "website",
    url: "https://www.myastro360.com",
    siteName: "MyAstro360",
    images: [{ url: "/og", width: 1200, height: 630, alt: "MyAstro360" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "MyAstro360 — Vedic Astrology Platform",
    description: "Instant astrology consultations, palmistry, Kundli, and more.",
    images: ["/og"],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // No maximumScale/userScalable lock — pinch-zoom must stay available
  // for accessibility (and it's a Lighthouse a11y audit).
  themeColor: "#ede4d0",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // `lang="en"` is intentionally STATIC here, and HtmlLangSync patches it to
    // the real locale on the client. This is a deliberate trade-off, not an
    // oversight: the root layout sits ABOVE the `[locale]` segment, so it can't
    // read the locale from params, and deriving it from `headers()` would make
    // the root layout dynamic — opting EVERY route out of static generation and
    // gutting the SSG/ISR the localized SEO surfaces depend on. The strong
    // language signals (hreflang, canonical, and the fully-translated SSR
    // content via I18nProvider) are already correct at first byte; only the
    // `lang` attribute on the 11 prefixed locales is client-corrected. The
    // SSR-correct alternative is rooting all routes under `[locale]` with a
    // rewrite middleware — see docs; deferred as too large for the payoff.
    <html lang="en" className={`${sans.variable} ${display.variable} ${notoVars}`}>
      <body className="min-h-screen flex flex-col">
        {process.env.NEXT_PUBLIC_GA_ID ? (
          <GoogleAnalytics gaId={process.env.NEXT_PUBLIC_GA_ID} />
        ) : null}
        {process.env.NEXT_PUBLIC_POSTHOG_KEY ? (
          <PostHogAnalytics
            apiKey={process.env.NEXT_PUBLIC_POSTHOG_KEY}
            host={process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com"}
          />
        ) : null}
        {/* Core Web Vitals → analytics sinks (no-op until a sink is present). */}
        <WebVitals />
        <HtmlLangSync />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: jsonLdHtml(ORGANIZATION_JSON_LD) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: jsonLdHtml(WEBSITE_JSON_LD) }}
        />
        {/* Warm paper grain overlay — sits below interactive content but
            above the body bg, so the entire surface gains a soft analog
            tactility without ever blocking pointer events. */}
        <div aria-hidden className="grain pointer-events-none fixed inset-0 z-[1]" />
        {/* Banner must sit above the fixed Navbar so the impersonation
            warning is unmissable; it only renders when the active JWT
            carries `impersonatedBy`, so normal users see nothing. */}
        <ImpersonationBanner />
        {/* Swap the auth-store token when the user lands at /?__imp=…
            This is a new tab handoff, so we run it before ProfileGate
            kicks in. Wrapped in Suspense because useSearchParams
            requires a boundary during SSR. */}
        <Suspense fallback={null}>
          <ImpersonateHandler />
        </Suspense>
        <RouteFocusReset />
        {/* Chrome is conditional: legacy Navbar/TraditionRail/FeatureChips
            sit on top of every route EXCEPT preview surfaces (/styleguide)
            where we want to evaluate the v2 design system in isolation,
            unobstructed by the cream-themed chrome we're about to replace.
            See ConditionalLayoutShell for the route allow-list. */}
        <ConditionalLayoutShell
          topChrome={
            <>
              <NavbarV2 />
              <FeatureBarV2 />
            </>
          }
          bottomChrome={<Footer />}
        >
          <ProfileGate>{children}</ProfileGate>
        </ConditionalLayoutShell>
      </body>
    </html>
  );
}
