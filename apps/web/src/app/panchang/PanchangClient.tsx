"use client";

import { useState, useEffect } from "react";
import { useTranslation } from "@/i18n";
import {
  translateTithi,
  translateNakshatra,
  translateYoga,
  translateVara,
  translateTimeRange,
} from "@/i18n/panchang-terms";
import Interpretation from "@/components/interpretation/Interpretation";
import { Moon, Star, Link as LinkIcon, Zap, CalendarDays, Sunrise, Sunset, MoonStar } from "lucide-react";

interface PanchangData {
  date: string;
  tithi: string;
  nakshatra: string;
  yoga: string;
  karana: string;
  vara: string;
  sunrise: string;
  sunset: string;
  moonrise: string;
  rahukaal: string;
  gulikakaal: string;
  yamakantaka: string;
}

const LOCALE_MAP: Record<string, string> = {
  en: "en-IN", hi: "hi-IN", ta: "ta-IN", te: "te-IN", bn: "bn-IN", mr: "mr-IN",
  gu: "gu-IN", kn: "kn-IN", ml: "ml-IN", pa: "pa-IN", or: "or-IN", as: "as-IN",
};

export default function PanchangClient({
  initialPanchang,
}: {
  /**
   * Server-fetched panchang (Delhi reference). Because this arrives as a
   * prop, the card grid below is part of the initial server-rendered HTML —
   * crawlers see today's tithi/nakshatra/timings without running JS. The
   * client only re-fetches when the user's locale needs localized strings.
   */
  initialPanchang?: PanchangData | null;
}) {
  const { t, locale } = useTranslation();
  const [panchang, setPanchang] = useState<PanchangData | null>(initialPanchang ?? null);
  const [loading, setLoading] = useState(!initialPanchang);
  const [error, setError] = useState("");

  useEffect(() => {
    // Server data is English; only round-trip when we need another locale
    // (or when the server fetch failed and we have nothing to show).
    if (initialPanchang && locale === "en") return;
    fetchPanchang();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locale]);

  const fetchPanchang = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api"}/astrology/panchang?locale=${locale}`
      );
      if (!res.ok) throw new Error(t.panchang.fetchFailed);
      const data = await res.json();
      setPanchang(data);
    } catch (err: any) {
      setError(err.message || t.panchang.loadFailed);
    } finally {
      setLoading(false);
    }
  };

  const panchangItems = panchang
    ? [
        { label: t.panchang.tithi, value: translateTithi(panchang.tithi, locale), icon: Moon, desc: t.panchang.tithiDesc },
        { label: t.panchang.nakshatraLabel, value: translateNakshatra(panchang.nakshatra, locale), icon: Star, desc: t.panchang.nakshatraDesc },
        { label: t.panchang.yoga, value: translateYoga(panchang.yoga, locale), icon: LinkIcon, desc: t.panchang.yogaDesc },
        { label: t.panchang.karana, value: panchang.karana, icon: Zap, desc: t.panchang.karanaDesc },
        { label: t.panchang.vara, value: translateVara(panchang.vara, locale), icon: CalendarDays, desc: t.panchang.varaDesc },
      ]
    : [];

  const timings = panchang
    ? [
        { label: t.panchang.sunrise, value: translateTimeRange(panchang.sunrise, locale), icon: Sunrise },
        { label: t.panchang.sunset, value: translateTimeRange(panchang.sunset, locale), icon: Sunset },
        { label: t.panchang.moonrise, value: translateTimeRange(panchang.moonrise, locale), icon: MoonStar },
      ]
    : [];

  const inauspicious = panchang
    ? [
        { label: t.panchang.rahuKaal, value: translateTimeRange(panchang.rahukaal, locale), desc: t.panchang.rahuKaalDesc },
        { label: t.panchang.gulikaKaal, value: translateTimeRange(panchang.gulikakaal, locale), desc: t.panchang.gulikaKaalDesc },
        { label: t.panchang.yamakantaka, value: translateTimeRange(panchang.yamakantaka, locale), desc: t.panchang.yamakantakaDesc },
      ]
    : [];

  // NOTE: the page H1 (FeatureHeader) and the crawlable city/feature links
  // are rendered by the SERVER wrapper in page.tsx — do not re-add them here.
  return (
    <div>
      <div className="relative mx-auto max-w-5xl px-4 py-10 sm:py-14 fade-in-up">
        {loading && (
          <div className="flex items-center justify-center py-20">
            <svg className="w-8 h-8 animate-spin text-primary-500" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </div>
        )}

        {error && (
          <div className="text-center py-12">
            <div className="inline-block p-4 rounded-2xl bg-red-500/10 border border-red-500/20 mb-4">
              <p className="text-red-400">{error}</p>
            </div>
            <button onClick={fetchPanchang} className="mt-4 px-6 py-2 rounded-xl btn-secondary text-sm text-primary-400 hover:bg-[rgba(12,8,5,0.06)]">
              {t.panchang.retry}
            </button>
          </div>
        )}

        {panchang && !loading && (
          <>
            {/* Date */}
            <div className="surface-card p-6 mb-8 text-center">
              <p className="text-sm text-[rgba(12,8,5,0.66)] mb-1">{t.panchang.date}</p>
              <p className="text-2xl font-bold text-surface-950">
                {new Date(panchang.date).toLocaleDateString(LOCALE_MAP[locale] || "en-IN", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
              </p>
              <p className="text-sm text-accent-400 mt-1">{translateVara(panchang.vara, locale)}</p>
            </div>

            {/* Panchang Elements */}
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
              {panchangItems.map((item) => (
                <div key={item.label} className="surface-card p-6">
                  <div className="flex items-center gap-3 mb-3">
                    <item.icon size={22} strokeWidth={1.7} className="text-primary-700" aria-hidden />
                    <div>
                      <p className="text-xs text-[rgba(12,8,5,0.66)]">{item.desc}</p>
                      <p className="text-sm font-medium text-[rgba(12,8,5,0.66)]">{item.label}</p>
                    </div>
                  </div>
                  <p className="text-xl font-bold text-surface-950">{item.value}</p>
                </div>
              ))}
            </div>

            {/* Sun/Moon Timings */}
            <h2 className="text-xl font-bold text-gradient mb-4">{t.panchang.sunMoonTimings}</h2>
            <div className="grid grid-cols-3 gap-4 mb-8">
              {timings.map((tm) => (
                <div key={tm.label} className="surface-card p-5 text-center">
                  <tm.icon size={28} strokeWidth={1.6} className="mb-2 mx-auto text-primary-700" aria-hidden />
                  <p className="text-xs text-[rgba(12,8,5,0.66)] mb-1">{tm.label}</p>
                  <p className="text-lg font-bold text-surface-950">{tm.value}</p>
                </div>
              ))}
            </div>

            {/* Inauspicious Periods */}
            <h2 className="text-xl font-bold text-red-400 mb-4">{t.panchang.inauspiciousPeriods}</h2>
            <div className="grid sm:grid-cols-3 gap-4">
              {inauspicious.map((item) => (
                <div key={item.label} className="surface-card p-5 border border-red-500/10">
                  <p className="text-sm font-medium text-red-400 mb-1">{item.label}</p>
                  <p className="text-lg font-bold text-surface-950 mb-1">{item.value}</p>
                  <p className="text-xs text-[rgba(12,8,5,0.66)]">{item.desc}</p>
                </div>
              ))}
            </div>

            <Interpretation
              domain="panchang"
              className="mt-8"
              input={{
                vara: panchang.vara,
                tithi: panchang.tithi,
                nakshatra: panchang.nakshatra,
                yoga: panchang.yoga,
                karana: panchang.karana,
                rahukaal: panchang.rahukaal,
              }}
            />
          </>
        )}
      </div>
    </div>
  );
}
