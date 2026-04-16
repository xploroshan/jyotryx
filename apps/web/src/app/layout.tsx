import type { Metadata, Viewport } from "next";
import "./globals.css";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import ProfileGate from "@/components/auth/ProfileGate";
import TraditionRail from "@/components/layout/TraditionRail";
import FeatureChips from "@/components/layout/FeatureChips";

export const metadata: Metadata = {
  title: "Jyotron — Vedic Astrology Platform",
  description:
    "Instant, personalized Vedic astrology consultations. Kundli, palmistry, horoscopes, compatibility matching, and spiritual guidance — available 24/7.",
  icons: {
    icon: "/favicon.svg",
  },
  manifest: "/manifest.json",
  keywords: [
    "astrology", "vedic astrology", "kundli", "horoscope",
    "palmistry", "kundli matching", "panchang", "muhurat", "jyotron",
  ],
  metadataBase: new URL("https://www.jyotron.com"),
  openGraph: {
    title: "Jyotron — Vedic Astrology Platform",
    description: "Instant astrology consultations, palmistry, Kundli, and more.",
    type: "website",
    url: "https://www.jyotron.com",
    siteName: "Jyotron",
  },
  twitter: {
    card: "summary_large_image",
    title: "Jyotron — Vedic Astrology Platform",
    description: "Instant astrology consultations, palmistry, Kundli, and more.",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#09090b",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body className="min-h-screen flex flex-col">
        <Navbar />
        <TraditionRail />
        <FeatureChips />
        {/* Navbar is fixed (h-14). TraditionRail + FeatureChips are sticky
            (in normal flow), so only offset for the Navbar height. */}
        <main className="flex-1 pt-16">
          <ProfileGate>{children}</ProfileGate>
        </main>
        <Footer />
      </body>
    </html>
  );
}
