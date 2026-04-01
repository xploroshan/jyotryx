"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/store";

interface PlanetaryHour {
  planet: string;
  startTime: string;
  endTime: string;
  activities: string[];
  avoid: string[];
  isCurrent: boolean;
}

interface DailyBriefing {
  greeting: string;
  date: string;
  dayQuality: "excellent" | "good" | "moderate" | "challenging";
  summary: string;
  doList: string[];
  avoidList: string[];
  planetaryHours: PlanetaryHour[];
  currentHora: PlanetaryHour | null;
  luckyColor: string;
  luckyNumber: number;
  luckyTime: string;
  professionInsight: string;
  remedy: string;
  mantra: string;
  panchang: {
    tithi: string;
    nakshatra: string;
    yoga: string;
    vara: string;
    rahukaal: string;
  };
  transitAlert: string | null;
}

const qualityConfig = {
  excellent: { label: "Excellent Day", color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20", bar: "bg-emerald-500", width: "w-full" },
  good: { label: "Good Day", color: "text-blue-400", bg: "bg-blue-500/10 border-blue-500/20", bar: "bg-blue-500", width: "w-3/4" },
  moderate: { label: "Balanced Day", color: "text-amber-400", bg: "bg-amber-500/10 border-amber-500/20", bar: "bg-amber-500", width: "w-1/2" },
  challenging: { label: "Navigate Carefully", color: "text-red-400", bg: "bg-red-500/10 border-red-500/20", bar: "bg-red-500", width: "w-1/4" },
};

const planetColors: Record<string, string> = {
  Sun: "text-orange-400", Moon: "text-slate-300", Mars: "text-red-400",
  Mercury: "text-emerald-400", Jupiter: "text-yellow-400", Venus: "text-pink-400", Saturn: "text-blue-400",
};

export default function MyDayPage() {
  const router = useRouter();
  const { isAuthenticated, accessToken } = useAuthStore();
  const [briefing, setBriefing] = useState<DailyBriefing | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showAllHours, setShowAllHours] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) {
      router.push("/auth");
      return;
    }
    fetchBriefing();
  }, [isAuthenticated]);

  const fetchBriefing = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await api.get<DailyBriefing>("/daily-briefing", { token: accessToken! });
      setBriefing(data);
    } catch (err: any) {
      setError(err.message || "Failed to load daily briefing");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <svg className="w-10 h-10 animate-spin text-primary-500 mx-auto mb-4" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <p className="text-white/40 text-sm">Preparing your cosmic briefing...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="surface-card p-8 text-center max-w-md">
          <p className="text-red-400 mb-4">{error}</p>
          <button onClick={fetchBriefing} className="px-6 py-2 btn-primary rounded-xl text-sm">Retry</button>
        </div>
      </div>
    );
  }

  if (!briefing) return null;

  const qc = qualityConfig[briefing.dayQuality];
  const visibleHours = showAllHours ? briefing.planetaryHours : briefing.planetaryHours.filter((_, i) => {
    const currentIdx = briefing.planetaryHours.findIndex((h) => h.isCurrent);
    return i >= Math.max(0, currentIdx - 1) && i <= currentIdx + 4;
  });

  return (
    <div className="relative min-h-screen">
      <div className="absolute inset-0 bg-surface-950" />
      <div className="relative z-10 mx-auto max-w-4xl px-4 py-8">

        {/* Greeting + Quality */}
        <div className="mb-8">
          <h1 className="text-3xl sm:text-4xl font-bold text-white mb-2">{briefing.greeting}</h1>
          <p className="text-white/40 text-sm mb-4">{new Date(briefing.date).toLocaleDateString("en-IN", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</p>
          <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full border ${qc.bg}`}>
            <div className={`h-2 w-2 rounded-full ${qc.bar}`} />
            <span className={`text-sm font-medium ${qc.color}`}>{qc.label}</span>
          </div>
        </div>

        {/* Summary Card */}
        <div className="surface-card p-6 mb-6">
          <p className="text-white/80 leading-relaxed">{briefing.summary}</p>
        </div>

        {/* Transit Alert */}
        {briefing.transitAlert && (
          <div className="mb-6 p-4 rounded-xl bg-purple-500/10 border border-purple-500/20">
            <div className="flex items-start gap-3">
              <span className="text-purple-400 text-lg mt-0.5">&#9734;</span>
              <div>
                <p className="text-sm font-medium text-purple-300 mb-1">Transit Alert</p>
                <p className="text-sm text-purple-200/70">{briefing.transitAlert}</p>
              </div>
            </div>
          </div>
        )}

        {/* Do & Avoid Grid */}
        <div className="grid sm:grid-cols-2 gap-4 mb-6">
          <div className="surface-card p-5">
            <h3 className="text-sm font-semibold text-emerald-400 mb-3 flex items-center gap-2">
              <span>&#10003;</span> Things to Do Today
            </h3>
            <ul className="space-y-2">
              {briefing.doList.map((item, i) => (
                <li key={i} className="text-sm text-white/60 flex items-start gap-2">
                  <span className="text-emerald-400/60 mt-0.5">&#8226;</span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <div className="surface-card p-5">
            <h3 className="text-sm font-semibold text-red-400 mb-3 flex items-center gap-2">
              <span>&#10007;</span> Things to Avoid
            </h3>
            <ul className="space-y-2">
              {briefing.avoidList.map((item, i) => (
                <li key={i} className="text-sm text-white/60 flex items-start gap-2">
                  <span className="text-red-400/60 mt-0.5">&#8226;</span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Profession Insight */}
        <div className="surface-card p-5 mb-6">
          <h3 className="text-sm font-semibold text-primary-400 mb-2">Your Professional Insight</h3>
          <p className="text-sm text-white/60">{briefing.professionInsight}</p>
        </div>

        {/* Current Hora + Lucky */}
        <div className="grid sm:grid-cols-2 gap-4 mb-6">
          {briefing.currentHora && (
            <div className="surface-card p-5">
              <h3 className="text-sm font-semibold text-white mb-3">Current Planetary Hour</h3>
              <div className="flex items-center gap-3 mb-2">
                <span className={`text-2xl font-bold ${planetColors[briefing.currentHora.planet] || "text-white"}`}>
                  {briefing.currentHora.planet}
                </span>
                <span className="text-xs text-white/30">
                  {briefing.currentHora.startTime} - {briefing.currentHora.endTime}
                </span>
              </div>
              <p className="text-xs text-white/40">
                Best for: {briefing.currentHora.activities.join(", ")}
              </p>
            </div>
          )}
          <div className="surface-card p-5">
            <h3 className="text-sm font-semibold text-white mb-3">Lucky Today</h3>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <p className="text-xs text-white/30 mb-1">Color</p>
                <p className="text-sm text-white font-medium">{briefing.luckyColor}</p>
              </div>
              <div>
                <p className="text-xs text-white/30 mb-1">Number</p>
                <p className="text-sm text-white font-medium">{briefing.luckyNumber}</p>
              </div>
              <div>
                <p className="text-xs text-white/30 mb-1">Best Time</p>
                <p className="text-sm text-white font-medium">{briefing.luckyTime}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Planetary Hours Timeline */}
        <div className="surface-card p-5 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-white">Planetary Hours</h3>
            <button
              onClick={() => setShowAllHours(!showAllHours)}
              className="text-xs text-primary-400 hover:text-primary-300"
            >
              {showAllHours ? "Show relevant" : "Show all 24"}
            </button>
          </div>
          <div className="space-y-2">
            {visibleHours.map((hour, i) => (
              <div
                key={i}
                className={`flex items-center gap-3 p-3 rounded-lg transition-all ${
                  hour.isCurrent ? "bg-primary-600/15 border border-primary-500/30" : "bg-white/[0.02]"
                }`}
              >
                <span className={`text-sm font-semibold w-16 ${planetColors[hour.planet] || "text-white/60"}`}>
                  {hour.planet}
                </span>
                <span className="text-xs text-white/30 w-32">
                  {hour.startTime} - {hour.endTime}
                </span>
                <span className="text-xs text-white/50 flex-1">
                  {hour.activities.slice(0, 2).join(", ")}
                </span>
                {hour.isCurrent && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary-500/20 text-primary-300 font-medium">NOW</span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Panchang Mini */}
        <div className="surface-card p-5 mb-6">
          <h3 className="text-sm font-semibold text-white mb-3">Today&apos;s Panchang</h3>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {[
              { label: "Tithi", value: briefing.panchang.tithi },
              { label: "Nakshatra", value: briefing.panchang.nakshatra },
              { label: "Yoga", value: briefing.panchang.yoga },
              { label: "Day", value: briefing.panchang.vara },
              { label: "Rahu Kaal", value: briefing.panchang.rahukaal },
            ].map((item) => (
              <div key={item.label} className="text-center p-2 rounded-lg bg-white/[0.03]">
                <p className="text-[10px] text-white/30 mb-0.5">{item.label}</p>
                <p className="text-xs text-white/70 font-medium">{item.value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Remedy & Mantra */}
        <div className="grid sm:grid-cols-2 gap-4 mb-6">
          <div className="surface-card p-5">
            <h3 className="text-sm font-semibold text-accent-400 mb-2">Today&apos;s Remedy</h3>
            <p className="text-sm text-white/60">{briefing.remedy}</p>
          </div>
          <div className="surface-card p-5">
            <h3 className="text-sm font-semibold text-accent-400 mb-2">Today&apos;s Mantra</h3>
            <p className="text-lg text-white/80 font-medium text-center py-2">{briefing.mantra}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
