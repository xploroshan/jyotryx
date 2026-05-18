import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import { Inter, Fraunces } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import ProfileGate from "@/components/auth/ProfileGate";
import TraditionRail from "@/components/layout/TraditionRail";
import FeatureChips from "@/components/layout/FeatureChips";
import RouteFocusReset from "@/components/layout/RouteFocusReset";
import ImpersonateHandler from "@/components/auth/ImpersonateHandler";
import ImpersonationBanner from "@/components/auth/ImpersonationBanner";

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
  themeColor: "#fffdfa",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${display.variable}`}>
      <body className="min-h-screen flex flex-col">
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
        <Navbar />
        <TraditionRail />
        <FeatureChips />
        <RouteFocusReset />
        {/* Navbar is fixed (h-14). TraditionRail + FeatureChips are sticky
            (in normal flow), so only offset for the Navbar height.
            `tabIndex={-1}` lets RouteFocusReset move focus here on navigation
            without making <main> a tab stop. `focus:outline-none` keeps the
            focus transparent — a stray ring on the whole content area would
            be more distracting than the nav ring we're trying to clear. */}
        <main className="flex-1 pt-16 focus:outline-none" tabIndex={-1}>
          <ProfileGate>{children}</ProfileGate>
        </main>
        <Footer />
      </body>
    </html>
  );
}
