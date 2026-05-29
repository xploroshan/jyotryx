import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import { Inter, Fraunces } from "next/font/google";
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
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "myastro360 — Vedic Astrology Platform",
    description: "Instant astrology consultations, palmistry, Kundli, and more.",
    type: "website",
    url: "https://www.myastro360.com",
    siteName: "myastro360",
  },
  twitter: {
    card: "summary_large_image",
    title: "myastro360 — Vedic Astrology Platform",
    description: "Instant astrology consultations, palmistry, Kundli, and more.",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#ede4d0",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${display.variable}`}>
      <body className="min-h-screen flex flex-col">
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
