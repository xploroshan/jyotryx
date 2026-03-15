"use client";

import React, { useState } from "react";

const zodiacSigns = [
  { id: "aries", name: "Aries", symbol: "\u2648", date: "Mar 21 - Apr 19", element: "Fire" },
  { id: "taurus", name: "Taurus", symbol: "\u2649", date: "Apr 20 - May 20", element: "Earth" },
  { id: "gemini", name: "Gemini", symbol: "\u264A", date: "May 21 - Jun 20", element: "Air" },
  { id: "cancer", name: "Cancer", symbol: "\u264B", date: "Jun 21 - Jul 22", element: "Water" },
  { id: "leo", name: "Leo", symbol: "\u264C", date: "Jul 23 - Aug 22", element: "Fire" },
  { id: "virgo", name: "Virgo", symbol: "\u264D", date: "Aug 23 - Sep 22", element: "Earth" },
  { id: "libra", name: "Libra", symbol: "\u264E", date: "Sep 23 - Oct 22", element: "Air" },
  { id: "scorpio", name: "Scorpio", symbol: "\u264F", date: "Oct 23 - Nov 21", element: "Water" },
  { id: "sagittarius", name: "Sagittarius", symbol: "\u2650", date: "Nov 22 - Dec 21", element: "Fire" },
  { id: "capricorn", name: "Capricorn", symbol: "\u2651", date: "Dec 22 - Jan 19", element: "Earth" },
  { id: "aquarius", name: "Aquarius", symbol: "\u2652", date: "Jan 20 - Feb 18", element: "Air" },
  { id: "pisces", name: "Pisces", symbol: "\u2653", date: "Feb 19 - Mar 20", element: "Water" },
];

const periods = [
  { id: "daily", label: "Daily" },
  { id: "weekly", label: "Weekly" },
  { id: "monthly", label: "Monthly" },
  { id: "yearly", label: "Yearly" },
];

interface HoroscopeData {
  overview: string;
  love: string;
  career: string;
  health: string;
  lucky: { number: string; color: string; time: string };
}

export default function HoroscopePage() {
  const [selectedSign, setSelectedSign] = useState("aries");
  const [selectedPeriod, setSelectedPeriod] = useState("daily");
  const [horoscope, setHoroscope] = useState<HoroscopeData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const sign = zodiacSigns.find((s) => s.id === selectedSign)!;

  React.useEffect(() => {
    fetchHoroscope();
  }, [selectedSign, selectedPeriod]);

  const fetchHoroscope = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api"}/astrology/horoscope/${selectedSign}`
      );
      if (!res.ok) throw new Error("Failed to fetch horoscope");
      const data = await res.json();

      // Map API response to our display format
      setHoroscope({
        overview: data.prediction || "Horoscope data is currently unavailable. Please try again later.",
        love: `Compatibility with ${data.compatibility || "Leo"} is highlighted. ${data.mood || "Optimistic"} energy surrounds your relationships today.`,
        career: `Professional energy is ${data.mood?.toLowerCase() || "positive"} today. Focus on opportunities and remain open to collaboration.`,
        health: "Pay attention to your energy levels and maintain a balanced routine. Mindfulness practices are especially beneficial today.",
        lucky: {
          number: String(data.luckyNumber || "7"),
          color: data.luckyColor || "Purple",
          time: "2:00 PM - 4:00 PM",
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
      <div className="absolute inset-0 bg-gradient-to-b from-yellow-500/5 via-gray-950 to-gray-950" />
      <div className="absolute top-32 left-1/3 w-80 h-80 bg-accent-500/8 rounded-full blur-3xl" />
      <div className="absolute bottom-32 right-1/3 w-80 h-80 bg-primary-500/8 rounded-full blur-3xl" />

      <div className="relative z-10 mx-auto max-w-6xl px-4 py-12">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass text-sm text-gray-300 mb-4">
            <span className="text-lg">{sign.symbol}</span>
            Vedic Horoscope
          </div>
          <h1 className="text-4xl sm:text-5xl font-display font-bold mb-4">
            Your <span className="text-gradient">Horoscope</span>
          </h1>
          <p className="text-gray-400 max-w-xl mx-auto">
            Personalized predictions based on Vedic astrology and current planetary transits.
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
                  ? "glass bg-white/10 border-primary-500/50"
                  : "hover:bg-white/5"
              }`}
            >
              <span className="text-2xl mb-1">{z.symbol}</span>
              <span className={`text-xs font-medium ${selectedSign === z.id ? "text-white" : "text-gray-400"}`}>
                {z.name}
              </span>
            </button>
          ))}
        </div>

        {/* Selected Sign Info */}
        <div className="glass-card p-6 mb-8 flex flex-col sm:flex-row items-center gap-4">
          <div className="text-5xl">{sign.symbol}</div>
          <div className="text-center sm:text-left">
            <h2 className="text-2xl font-display font-bold text-white">{sign.name}</h2>
            <div className="flex flex-wrap gap-3 mt-1 justify-center sm:justify-start">
              <span className="text-sm text-gray-400">{sign.date}</span>
              <span className={`text-sm font-medium ${elementColor(sign.element)}`}>{sign.element}</span>
            </div>
          </div>
          <div className="sm:ml-auto">
            {/* Period Tabs */}
            <div className="flex gap-1 rounded-xl bg-white/5 p-1">
              {periods.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setSelectedPeriod(p.id)}
                  className={`px-4 py-2 rounded-lg text-xs font-medium transition-all ${
                    selectedPeriod === p.id
                      ? "bg-gradient-to-r from-primary-600 to-mystic-600 text-white"
                      : "text-gray-400 hover:text-white"
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
            <button onClick={fetchHoroscope} className="mt-4 px-6 py-2 rounded-xl glass text-sm text-primary-400 hover:bg-white/10">
              Retry
            </button>
          </div>
        )}

        {/* Horoscope Content */}
        {horoscope && !loading && !error && (
          <div className="grid lg:grid-cols-3 gap-6">
            {/* Overview */}
            <div className="lg:col-span-2 glass-card p-6">
              <h3 className="text-lg font-display font-bold text-gradient mb-4">
                {selectedPeriod.charAt(0).toUpperCase() + selectedPeriod.slice(1)} Overview
              </h3>
              <p className="text-gray-300 leading-relaxed">{horoscope.overview}</p>
            </div>

            {/* Lucky */}
            <div className="glass-card p-6">
              <h3 className="text-lg font-display font-bold text-accent-400 mb-4">Lucky Factors</h3>
              <div className="space-y-4">
                <div className="p-3 rounded-xl bg-white/5">
                  <p className="text-xs text-gray-500 mb-1">Lucky Numbers</p>
                  <p className="text-white font-semibold">{horoscope.lucky.number}</p>
                </div>
                <div className="p-3 rounded-xl bg-white/5">
                  <p className="text-xs text-gray-500 mb-1">Lucky Color</p>
                  <p className="text-white font-semibold">{horoscope.lucky.color}</p>
                </div>
                <div className="p-3 rounded-xl bg-white/5">
                  <p className="text-xs text-gray-500 mb-1">Auspicious Time</p>
                  <p className="text-white font-semibold">{horoscope.lucky.time}</p>
                </div>
              </div>
            </div>

            {/* Love */}
            <div className="glass-card p-6">
              <div className="flex items-center gap-2 mb-4">
                <span className="text-lg">💞</span>
                <h3 className="font-display font-bold text-white">Love &amp; Relationships</h3>
              </div>
              <p className="text-sm text-gray-300 leading-relaxed">{horoscope.love}</p>
            </div>

            {/* Career */}
            <div className="glass-card p-6">
              <div className="flex items-center gap-2 mb-4">
                <span className="text-lg">💼</span>
                <h3 className="font-display font-bold text-white">Career &amp; Finance</h3>
              </div>
              <p className="text-sm text-gray-300 leading-relaxed">{horoscope.career}</p>
            </div>

            {/* Health */}
            <div className="glass-card p-6">
              <div className="flex items-center gap-2 mb-4">
                <span className="text-lg">🏥</span>
                <h3 className="font-display font-bold text-white">Health &amp; Wellness</h3>
              </div>
              <p className="text-sm text-gray-300 leading-relaxed">{horoscope.health}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
