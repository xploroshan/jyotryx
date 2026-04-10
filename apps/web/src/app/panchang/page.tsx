"use client";

import { useState, useEffect } from "react";
import { useTranslation } from "@/i18n";

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

export default function PanchangPage() {
  const { t, locale } = useTranslation();
  const [panchang, setPanchang] = useState<PanchangData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchPanchang(); }, [locale]);

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
        { label: t.panchang.tithi, value: panchang.tithi, icon: "🌙", desc: t.panchang.tithiDesc },
        { label: t.panchang.nakshatraLabel, value: panchang.nakshatra, icon: "✨", desc: t.panchang.nakshatraDesc },
        { label: t.panchang.yoga, value: panchang.yoga, icon: "🔗", desc: t.panchang.yogaDesc },
        { label: t.panchang.karana, value: panchang.karana, icon: "⚡", desc: t.panchang.karanaDesc },
        { label: t.panchang.vara, value: panchang.vara, icon: "📆", desc: t.panchang.varaDesc },
      ]
    : [];

  const timings = panchang
    ? [
        { label: t.panchang.sunrise, value: panchang.sunrise, icon: "🌅" },
        { label: t.panchang.sunset, value: panchang.sunset, icon: "🌇" },
        { label: t.panchang.moonrise, value: panchang.moonrise, icon: "🌕" },
      ]
    : [];

  const inauspicious = panchang
    ? [
        { label: t.panchang.rahuKaal, value: panchang.rahukaal, desc: t.panchang.rahuKaalDesc },
        { label: t.panchang.gulikaKaal, value: panchang.gulikakaal, desc: t.panchang.gulikaKaalDesc },
        { label: t.panchang.yamakantaka, value: panchang.yamakantaka, desc: t.panchang.yamakantakaDesc },
      ]
    : [];

  return (
    <div className="relative min-h-screen">
      <div className="absolute inset-0 bg-gradient-to-b from-amber-500/5 via-gray-950 to-gray-950" />
      <div className="absolute top-32 left-1/4 w-80 h-80 bg-accent-500/8 rounded-full blur-3xl" />
      <div className="absolute bottom-32 right-1/4 w-80 h-80 bg-primary-500/8 rounded-full blur-3xl" />

      <div className="relative z-10 mx-auto max-w-5xl px-4 py-12">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full btn-secondary text-sm text-white/60 mb-4">
            <span className="text-lg">🕉️</span>
            {t.panchang.badge}
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold mb-4">
            {t.panchang.title} <span className="text-gradient">{t.panchang.titleHighlight}</span>
          </h1>
          <p className="text-white/40 max-w-xl mx-auto">
            {t.panchang.description}
          </p>
        </div>

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
            <button onClick={fetchPanchang} className="mt-4 px-6 py-2 rounded-xl btn-secondary text-sm text-primary-400 hover:bg-white/[0.1]">
              {t.panchang.retry}
            </button>
          </div>
        )}

        {panchang && !loading && (
          <>
            {/* Date */}
            <div className="surface-card p-6 mb-8 text-center">
              <p className="text-sm text-white/30 mb-1">{t.panchang.date}</p>
              <p className="text-2xl font-bold text-white">
                {new Date(panchang.date).toLocaleDateString(LOCALE_MAP[locale] || "en-IN", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
              </p>
              <p className="text-sm text-accent-400 mt-1">{panchang.vara}</p>
            </div>

            {/* Panchang Elements */}
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
              {panchangItems.map((item) => (
                <div key={item.label} className="surface-card p-6">
                  <div className="flex items-center gap-3 mb-3">
                    <span className="text-2xl">{item.icon}</span>
                    <div>
                      <p className="text-xs text-white/30">{item.desc}</p>
                      <p className="text-sm font-medium text-white/40">{item.label}</p>
                    </div>
                  </div>
                  <p className="text-xl font-bold text-white">{item.value}</p>
                </div>
              ))}
            </div>

            {/* Sun/Moon Timings */}
            <h2 className="text-xl font-bold text-gradient mb-4">{t.panchang.sunMoonTimings}</h2>
            <div className="grid grid-cols-3 gap-4 mb-8">
              {timings.map((tm) => (
                <div key={tm.label} className="surface-card p-5 text-center">
                  <span className="text-3xl block mb-2">{tm.icon}</span>
                  <p className="text-xs text-white/30 mb-1">{tm.label}</p>
                  <p className="text-lg font-bold text-white">{tm.value}</p>
                </div>
              ))}
            </div>

            {/* Inauspicious Periods */}
            <h2 className="text-xl font-bold text-red-400 mb-4">{t.panchang.inauspiciousPeriods}</h2>
            <div className="grid sm:grid-cols-3 gap-4">
              {inauspicious.map((item) => (
                <div key={item.label} className="surface-card p-5 border border-red-500/10">
                  <p className="text-sm font-medium text-red-400 mb-1">{item.label}</p>
                  <p className="text-lg font-bold text-white mb-1">{item.value}</p>
                  <p className="text-xs text-white/30">{item.desc}</p>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
