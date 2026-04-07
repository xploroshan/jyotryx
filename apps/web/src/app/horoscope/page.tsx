"use client";

import React, { useState } from "react";
import { useTranslation } from "@/i18n";

interface HoroscopeData {
  overview: string;
  love: string;
  career: string;
  health: string;
  lucky: { number: string; color: string; time: string };
}

export default function HoroscopePage() {
  const { t } = useTranslation();

  const zodiacSigns = [
    { id: "aries", name: t.horoscope.aries, symbol: "\u2648", date: "Apr 14 - May 14", element: t.horoscope.fire },
    { id: "taurus", name: t.horoscope.taurus, symbol: "\u2649", date: "May 15 - Jun 14", element: t.horoscope.earth },
    { id: "gemini", name: t.horoscope.gemini, symbol: "\u264A", date: "Jun 15 - Jul 16", element: t.horoscope.air },
    { id: "cancer", name: t.horoscope.cancer, symbol: "\u264B", date: "Jul 17 - Aug 16", element: t.horoscope.water },
    { id: "leo", name: t.horoscope.leo, symbol: "\u264C", date: "Aug 17 - Sep 16", element: t.horoscope.fire },
    { id: "virgo", name: t.horoscope.virgo, symbol: "\u264D", date: "Sep 17 - Oct 16", element: t.horoscope.earth },
    { id: "libra", name: t.horoscope.libra, symbol: "\u264E", date: "Oct 17 - Nov 15", element: t.horoscope.air },
    { id: "scorpio", name: t.horoscope.scorpio, symbol: "\u264F", date: "Nov 16 - Dec 15", element: t.horoscope.water },
    { id: "sagittarius", name: t.horoscope.sagittarius, symbol: "\u2650", date: "Dec 16 - Jan 13", element: t.horoscope.fire },
    { id: "capricorn", name: t.horoscope.capricorn, symbol: "\u2651", date: "Jan 14 - Feb 12", element: t.horoscope.earth },
    { id: "aquarius", name: t.horoscope.aquarius, symbol: "\u2652", date: "Feb 13 - Mar 14", element: t.horoscope.air },
    { id: "pisces", name: t.horoscope.pisces, symbol: "\u2653", date: "Mar 15 - Apr 13", element: t.horoscope.water },
  ];

  const periods = [
    { id: "daily", label: t.horoscope.daily },
    { id: "weekly", label: t.horoscope.weekly },
    { id: "monthly", label: t.horoscope.monthly },
    { id: "yearly", label: t.horoscope.yearly },
  ];

  const [selectedSign, setSelectedSign] = useState("aries");
  const [selectedPeriod, setSelectedPeriod] = useState("daily");
  const [horoscope, setHoroscope] = useState<HoroscopeData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const sign = zodiacSigns.find((s) => s.id === selectedSign)!;

  // eslint-disable-next-line react-hooks/exhaustive-deps
  React.useEffect(() => {
    fetchHoroscope();
  }, [selectedSign, selectedPeriod]);

  const fetchHoroscope = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api"}/astrology/horoscope/${selectedSign}?period=${selectedPeriod}`
      );
      if (!res.ok) throw new Error("Failed to fetch horoscope");
      const data = await res.json();

      const periodLabel = selectedPeriod === "daily" ? "today" : `this ${selectedPeriod.replace("ly", "")}`;

      // Map API response to our display format
      setHoroscope({
        overview: data.prediction || "Horoscope data is currently unavailable. Please try again later.",
        love: data.love || `Compatibility with ${data.compatibility || "Leo"} is highlighted ${periodLabel}. Relationship dynamics are influenced by Venus's current transit, bringing warmth and deeper connections.`,
        career: data.career || `Professional energy is ${data.mood?.toLowerCase() || "positive"} ${periodLabel}. Planetary transits support strategic decisions and career growth.`,
        health: data.health || `Your vitality is supported by favorable planetary alignments ${periodLabel}. Maintain a balanced routine and incorporate mindfulness practices for optimal well-being.`,
        lucky: {
          number: String(data.luckyNumber || "7"),
          color: data.luckyColor || "Purple",
          time: selectedPeriod === "daily" ? "2:00 PM - 4:00 PM" : "Varies by day",
        },
      });
    } catch {
      setError("Could not load horoscope. Please check your connection and try again.");
      setHoroscope(null);
    } finally {
      setLoading(false);
    }
  };

  const elementColor = (el: string) =>
    el === "Fire" ? "text-red-400" : el === "Earth" ? "text-emerald-400" : el === "Air" ? "text-sky-400" : "text-blue-400";

  return (
    <div className="relative min-h-screen">
      <div className="absolute inset-0 bg-gradient-to-b from-primary-900/10 via-gray-950 to-gray-950" />
      <div className="absolute top-32 left-1/3 w-80 h-80 bg-accent-500/8 rounded-full blur-3xl" />
      <div className="absolute bottom-32 right-1/3 w-80 h-80 bg-primary-500/8 rounded-full blur-3xl" />

      <div className="relative z-10 mx-auto max-w-6xl px-4 py-12">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full surface-card text-sm text-white/60 mb-4">
            <span className="text-lg">{sign.symbol}</span>
            {t.horoscope.badge}
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold mb-4">
            {t.horoscope.title} <span className="text-gradient">{t.horoscope.titleHighlight}</span>
          </h1>
          <p className="text-white/40 max-w-xl mx-auto">
            {t.horoscope.description}
          </p>
        </div>

        {/* Zodiac Grid */}
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-12 gap-2 mb-8">
          {zodiacSigns.map((z) => (
            <button
              key={z.id}
              onClick={() => setSelectedSign(z.id)}
              className={`flex flex-col items-center py-3 px-2 rounded-xl transition-all ${
                selectedSign === z.id
                  ? "surface-card bg-white/[0.06] border-primary-500/50"
                  : "hover:bg-white/[0.03]"
              }`}
            >
              <span className="text-2xl mb-1">{z.symbol}</span>
              <span className={`text-xs font-medium ${selectedSign === z.id ? "text-white" : "text-white/40"}`}>
                {z.name}
              </span>
            </button>
          ))}
        </div>

        {/* Selected Sign Info */}
        <div className="surface-card p-6 mb-8 flex flex-col sm:flex-row items-center gap-4">
          <div className="text-4xl">{sign.symbol}</div>
          <div className="text-center sm:text-left">
            <h2 className="text-xl font-bold text-white">{sign.name}</h2>
            <div className="flex flex-wrap gap-3 mt-1 justify-center sm:justify-start">
              <span className="text-sm text-white/40">{sign.date}</span>
              <span className={`text-sm font-medium ${elementColor(sign.element)}`}>{sign.element}</span>
            </div>
          </div>
          <div className="sm:ml-auto">
            {/* Period Tabs */}
            <div className="flex gap-1 rounded-xl bg-white/[0.03] p-1">
              {periods.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setSelectedPeriod(p.id)}
                  className={`px-4 py-2 rounded-lg text-xs font-medium transition-all ${
                    selectedPeriod === p.id
                      ? "btn-primary text-white"
                      : "text-white/40 hover:text-white"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-16">
            <svg className="w-8 h-8 animate-spin text-primary-500" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </div>
        )}

        {/* Error */}
        {error && !loading && (
          <div className="text-center py-12">
            <div className="inline-block p-4 rounded-2xl bg-red-500/10 border border-red-500/20 mb-4">
              <p className="text-red-400">{error}</p>
            </div>
            <br />
            <button onClick={fetchHoroscope} className="mt-4 px-6 py-2 rounded-xl btn-secondary text-sm text-primary-400">
              {t.horoscope.retry}
            </button>
          </div>
        )}

        {/* Horoscope Content */}
        {horoscope && !loading && !error && (
          <div className="grid lg:grid-cols-3 gap-6">
            {/* Overview */}
            <div className="lg:col-span-2 surface-card p-6">
              <h3 className="text-lg font-bold text-gradient mb-4">
                {selectedPeriod.charAt(0).toUpperCase() + selectedPeriod.slice(1)} {t.horoscope.overview}
              </h3>
              <p className="text-white/60 leading-relaxed">{horoscope.overview}</p>
            </div>

            {/* Lucky */}
            <div className="surface-card p-6">
              <h3 className="text-lg font-bold text-accent-400 mb-4">{t.horoscope.luckyFactors}</h3>
              <div className="space-y-4">
                <div className="p-3 rounded-xl bg-white/[0.03]">
                  <p className="text-xs text-white/30 mb-1">{t.horoscope.luckyNumbers}</p>
                  <p className="text-white font-semibold">{horoscope.lucky.number}</p>
                </div>
                <div className="p-3 rounded-xl bg-white/[0.03]">
                  <p className="text-xs text-white/30 mb-1">{t.horoscope.luckyColor}</p>
                  <p className="text-white font-semibold">{horoscope.lucky.color}</p>
                </div>
                <div className="p-3 rounded-xl bg-white/[0.03]">
                  <p className="text-xs text-white/30 mb-1">{t.horoscope.auspiciousTime}</p>
                  <p className="text-white font-semibold">{horoscope.lucky.time}</p>
                </div>
              </div>
            </div>

            {/* Love */}
            <div className="surface-card p-6">
              <div className="flex items-center gap-2 mb-4">
                <h3 className="font-bold text-white">{t.horoscope.loveRelationships}</h3>
              </div>
              <p className="text-sm text-white/60 leading-relaxed">{horoscope.love}</p>
            </div>

            {/* Career */}
            <div className="surface-card p-6">
              <div className="flex items-center gap-2 mb-4">
                <h3 className="font-bold text-white">{t.horoscope.careerFinance}</h3>
              </div>
              <p className="text-sm text-white/60 leading-relaxed">{horoscope.career}</p>
            </div>

            {/* Health */}
            <div className="surface-card p-6">
              <div className="flex items-center gap-2 mb-4">
                <h3 className="font-bold text-white">{t.horoscope.healthWellness}</h3>
              </div>
              <p className="text-sm text-white/60 leading-relaxed">{horoscope.health}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
