import type { Metadata } from "next";
import "./globals.css";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";

export const metadata: Metadata = {
  title: "Jyotryx - AI-Powered Astrology Platform",
  description:
    "Get instant, personalized astrology consultations with AI. Palmistry, Kundli, horoscopes, compatibility matching, and spiritual guidance available 24/7.",
  keywords: [
    "astrology", "AI astrologer", "palmistry", "kundli", "horoscope",
    "vedic astrology", "kundli matching", "panchang", "muhurat",
  ],
  openGraph: {
    title: "Jyotryx - AI-Powered Astrology Platform",
    description: "Instant AI astrology consultations, palmistry, Kundli, and more.",
    type: "website",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen flex flex-col">
        <Navbar />
        <main className="flex-1 pt-16">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
