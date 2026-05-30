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
import HtmlLangSync from "@/components/i18n/HtmlLangSync";
import { GoogleAnalytics } from "@/components/analytics/GoogleAnalytics";

// Sitewide structured data. The Organization node feeds brand knowledge
// panels and lets answer engines (ChatGPT, Perplexity, Gemini) attribute
// the product correctly; the WebSite node is what Google uses for the
// sitelinks search box. Emitted once in the root layout so every route
// carries it without per-page duplication.
const ORGANIZATION_JSON_LD = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "myastro360",
  url: SITE_ORIGIN,
  logo: `${SITE_ORIGIN}/logo.svg`,
  description:
    "myastro360 is a Vedic astrology platform offering instant, personalized Kundli, horoscopes, palmistry, compatibility matching, panchang, and muhurat guidance.",
};

const WEBSITE_JSON_LD = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "myastro360",
  url: SITE_ORIGIN,
};

// We expose the next/font families as their own CSS variables and let the
// theme tokens in globals.css extend them with system fallbacks. Doing it
// this way avoids a recursive `--font-sans: var(--font-sans), …` declaration
// in `@theme`.
const sans = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-sans-inter",
  display: "swap",
});

const display = Fraunces({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
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
  title: "myastro360 — Vedic Astrology Platform",
  description:
    "Instant, personalized Vedic astrology consultations. Kundli, palmistry, horoscopes, compatibility matching, and spiritual guidance — available 24/7.",
  icons: {
    icon: "/favicon.svg",
  },
  manifest: "/manifest.json",
  keywords: [
    "astrology", "vedic astrology", "kundli", "horoscope",
    "palmistry", "kundli matching", "panchang", "muhurat", "myastro360",
  ],
  metadataBase: new URL("https://www.myastro360.com"),
  // Google Search Console site verification. Set NEXT_PUBLIC_GSC_VERIFICATION
  // in the Vercel env to the token GSC gives you (the value of the
  // `google-site-verification` meta tag) to verify ownership without a code
  // change. Omitted from the <head> when unset. (DNS TXT verification is an
  // alternative and doesn't need this.)
  ...(process.env.NEXT_PUBLIC_GSC_VERIFICATION
    ? { verification: { google: process.env.NEXT_PUBLIC_GSC_VERIFICATION } }
    : {}),
  // NOTE: no `alternates.canonical` here on purpose. A static canonical in
  // the root layout is inherited by every page that doesn't override it,
  // which canonicalises all feature pages to "/". Each page sets its own
  // self-canonical via `pageMetadata()`; pages without one self-canonicalise.
  openGraph: {
    title: "myastro360 — Vedic Astrology Platform",
    description: "Instant astrology consultations, palmistry, Kundli, and more.",
    type: "website",
    url: "https://www.myastro360.com",
    siteName: "myastro360",
    images: [{ url: "/og", width: 1200, height: 630, alt: "myastro360" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "myastro360 — Vedic Astrology Platform",
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
        <HtmlLangSync />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(ORGANIZATION_JSON_LD) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(WEBSITE_JSON_LD) }}
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
