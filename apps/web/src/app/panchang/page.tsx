"use client";

import { useState, useEffect } from "react";

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

export default function PanchangPage() {
  const [panchang, setPanchang] = useState<PanchangData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchPanchang();
  }, []);

  const fetchPanchang = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api"}/astrology/panchang`
      );
      if (!res.ok) throw new Error("Failed to fetch Panchang data");
      const data = await res.json();
      setPanchang(data);
    } catch (err: any) {
      setError(err.message || "Could not load Panchang. Please try again later.");
    } finally {
      setLoading(false);
    }
  };

  const panchangItems = panchang
    ? [
        { label: "Tithi", value: panchang.tithi, icon: "🌙", desc: "Lunar Day" },
        { label: "Nakshatra", value: panchang.nakshatra, icon: "✨", desc: "Birth Star" },
        { label: "Yoga", value: panchang.yoga, icon: "🔗", desc: "Planetary Combination" },
        { label: "Karana", value: panchang.karana, icon: "⚡", desc: "Half-day Period" },
        { label: "Vara", value: panchang.vara, icon: "📆", desc: "Day of Week" },
      ]
    : [];

  const timings = panchang
    ? [
        { label: "Sunrise", value: panchang.sunrise, icon: "🌅" },
        { label: "Sunset", value: panchang.sunset, icon: "🌇" },
        { label: "Moonrise", value: panchang.moonrise, icon: "🌕" },
      ]
    : [];

  const inauspicious = panchang
    ? [
        { label: "Rahu Kaal", value: panchang.rahukaal, desc: "Avoid starting new work" },
        { label: "Gulika Kaal", value: panchang.gulikakaal, desc: "Inauspicious period" },
        { label: "Yamakantaka", value: panchang.yamakantaka, desc: "Avoid travel" },
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
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass text-sm text-gray-300 mb-4">
            <span className="text-lg">🕉️</span>
            Hindu Calendar
          </div>
          <h1 className="text-4xl sm:text-5xl font-display font-bold mb-4">
            Today&apos;s <span className="text-gradient">Panchang</span>
          </h1>
          <p className="text-gray-400 max-w-xl mx-auto">
            Complete daily Hindu calendar with Tithi, Nakshatra, Yoga, Karana, and auspicious timings.
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
            <button onClick={fetchPanchang} className="mt-4 px-6 py-2 rounded-xl glass text-sm text-primary-400 hover:bg-white/10">
              Retry
            </button>
          </div>
        )}

        {panchang && !loading && (
          <>
            {/* Date */}
            <div className="glass-card p-6 mb-8 text-center">
              <p className="text-sm text-gray-500 mb-1">Date</p>
              <p className="text-2xl font-display font-bold text-white">
                {new Date(panchang.date).toLocaleDateString("en-IN", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
              </p>
              <p className="text-sm text-accent-400 mt-1">{panchang.vara}</p>
            </div>

            {/* Panchang Elements */}
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
              {panchangItems.map((item) => (
                <div key={item.label} className="glass-card p-6">
                  <div className="flex items-center gap-3 mb-3">
                    <span className="text-2xl">{item.icon}</span>
                    <div>
                      <p className="text-xs text-gray-500">{item.desc}</p>
                      <p className="text-sm font-medium text-gray-400">{item.label}</p>
                    </div>
                  </div>
                  <p className="text-xl font-display font-bold text-white">{item.value}</p>
                </div>
              ))}
            </div>

            {/* Sun/Moon Timings */}
            <h2 className="text-xl font-display font-bold text-gradient mb-4">Sun & Moon Timings</h2>
            <div className="grid grid-cols-3 gap-4 mb-8">
              {timings.map((t) => (
                <div key={t.label} className="glass-card p-5 text-center">
                  <span className="text-3xl block mb-2">{t.icon}</span>
                  <p className="text-xs text-gray-500 mb-1">{t.label}</p>
                  <p className="text-lg font-bold text-white">{t.value}</p>
                </div>
              ))}
            </div>

            {/* Inauspicious Periods */}
            <h2 className="text-xl font-display font-bold text-red-400 mb-4">Inauspicious Periods</h2>
            <div className="grid sm:grid-cols-3 gap-4">
              {inauspicious.map((item) => (
                <div key={item.label} className="glass-card p-5 border border-red-500/10">
                  <p className="text-sm font-medium text-red-400 mb-1">{item.label}</p>
                  <p className="text-lg font-bold text-white mb-1">{item.value}</p>
                  <p className="text-xs text-gray-500">{item.desc}</p>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
