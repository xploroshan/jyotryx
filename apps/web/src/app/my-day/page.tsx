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
  excellent: { label: "Excellent Day", emoji: "\u2728", color: "text-emerald-400", ring: "ring-emerald-500/30", bg: "bg-emerald-500/10", bar: "bg-emerald-400", glow: "shadow-emerald-500/20", pct: 100 },
  good: { label: "Good Day", emoji: "\u2600\ufe0f", color: "text-sky-400", ring: "ring-sky-500/30", bg: "bg-sky-500/10", bar: "bg-sky-400", glow: "shadow-sky-500/20", pct: 75 },
  moderate: { label: "Balanced Day", emoji: "\u2696\ufe0f", color: "text-amber-400", ring: "ring-amber-500/30", bg: "bg-amber-500/10", bar: "bg-amber-400", glow: "shadow-amber-500/20", pct: 50 },
  challenging: { label: "Navigate Carefully", emoji: "\ud83c\udf19", color: "text-orange-400", ring: "ring-orange-500/30", bg: "bg-orange-500/10", bar: "bg-orange-400", glow: "shadow-orange-500/20", pct: 25 },
};

const planetIcons: Record<string, { symbol: string; color: string; bg: string }> = {
  Sun: { symbol: "\u2609", color: "text-amber-400", bg: "bg-amber-500/10" },
  Moon: { symbol: "\u263d", color: "text-slate-300", bg: "bg-slate-400/10" },
  Mars: { symbol: "\u2642", color: "text-red-400", bg: "bg-red-500/10" },
  Mercury: { symbol: "\u263f", color: "text-emerald-400", bg: "bg-emerald-500/10" },
  Jupiter: { symbol: "\u2643", color: "text-yellow-400", bg: "bg-yellow-500/10" },
  Venus: { symbol: "\u2640", color: "text-pink-400", bg: "bg-pink-500/10" },
  Saturn: { symbol: "\u2644", color: "text-indigo-400", bg: "bg-indigo-500/10" },
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
          <div className="relative w-16 h-16 mx-auto mb-6">
            <div className="absolute inset-0 rounded-full border-2 border-primary-500/20" />
            <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-primary-500 animate-spin" />
            <div className="absolute inset-3 rounded-full border border-accent-500/20" />
            <div className="absolute inset-3 rounded-full border border-transparent border-t-accent-400 animate-spin [animation-direction:reverse] [animation-duration:1.5s]" />
          </div>
          <p className="text-white/40 text-sm">Reading the stars for you...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="surface-card p-8 text-center max-w-md">
          <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-red-500/10 flex items-center justify-center">
            <svg className="w-6 h-6 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
          </div>
          <p className="text-red-400 mb-1 text-sm font-medium">Something went wrong</p>
          <p className="text-white/40 text-xs mb-5">{error}</p>
          <button onClick={fetchBriefing} className="px-6 py-2.5 btn-primary rounded-xl text-sm">Try Again</button>
        </div>
      </div>
    );
  }

  if (!briefing) return null;

  const qc = qualityConfig[briefing.dayQuality];
  const currentIdx = briefing.planetaryHours.findIndex((h) => h.isCurrent);
  const visibleHours = showAllHours
    ? briefing.planetaryHours
    : briefing.planetaryHours.filter((_, i) => i >= Math.max(0, currentIdx - 1) && i <= currentIdx + 4);

  return (
    <div className="min-h-screen bg-surface-950">
      {/* ── Hero Section ── */}
      <div className="relative overflow-hidden">
        {/* Background glow */}
        <div className="absolute inset-0 bg-gradient-to-b from-primary-600/8 via-transparent to-transparent" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-primary-500/5 rounded-full blur-3xl" />

        <div className="relative mx-auto max-w-5xl px-4 pt-8 pb-6 sm:pt-12 sm:pb-10">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
            <div>
              <p className="text-xs font-medium text-primary-400/80 tracking-widest uppercase mb-2">
                {new Date(briefing.date).toLocaleDateString("en-IN", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
              </p>
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white tracking-tight">
                {briefing.greeting}
              </h1>
            </div>

            {/* Day Quality Badge */}
            <div className={`flex items-center gap-3 px-5 py-3 rounded-2xl ${qc.bg} ring-1 ${qc.ring} self-start sm:self-auto`}>
              <div className="flex flex-col items-center gap-1">
                <span className="text-2xl leading-none">{qc.emoji}</span>
              </div>
              <div>
                <p className={`text-sm font-semibold ${qc.color}`}>{qc.label}</p>
                <div className="mt-1.5 w-24 h-1 rounded-full bg-white/[0.06] overflow-hidden">
                  <div className={`h-full rounded-full ${qc.bar} transition-all duration-1000`} style={{ width: `${qc.pct}%` }} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-4 pb-16">
        {/* ── Summary ── */}
        <div className="relative mb-8 p-6 rounded-2xl bg-gradient-to-br from-white/[0.04] to-white/[0.02] border border-white/[0.06]">
          <div className="absolute top-4 left-4 w-1 h-8 rounded-full bg-gradient-to-b from-primary-500 to-accent-500" />
          <p className="text-white/80 leading-relaxed pl-4 text-[15px]">{briefing.summary}</p>
        </div>

        {/* ── Transit Alert ── */}
        {briefing.transitAlert && (
          <div className="mb-8 p-5 rounded-2xl bg-gradient-to-r from-purple-500/8 to-fuchsia-500/5 border border-purple-500/15">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-purple-500/15 flex items-center justify-center shrink-0">
                <svg className="w-4.5 h-4.5 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-semibold text-purple-300 mb-1">Planetary Transit</p>
                <p className="text-sm text-purple-200/60 leading-relaxed">{briefing.transitAlert}</p>
              </div>
            </div>
          </div>
        )}

        {/* ── Do & Avoid ── */}
        <div className="grid sm:grid-cols-2 gap-4 mb-8">
          <div className="p-5 rounded-2xl bg-white/[0.03] border border-white/[0.06]">
            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                <svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
              </div>
              <h3 className="text-sm font-semibold text-white">Favorable Today</h3>
            </div>
            <ul className="space-y-2.5">
              {briefing.doList.map((item, i) => (
                <li key={i} className="flex items-start gap-2.5 text-sm text-white/60">
                  <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-emerald-500/50 shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <div className="p-5 rounded-2xl bg-white/[0.03] border border-white/[0.06]">
            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center">
                <svg className="w-4 h-4 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <h3 className="text-sm font-semibold text-white">Best to Avoid</h3>
            </div>
            <ul className="space-y-2.5">
              {briefing.avoidList.map((item, i) => (
                <li key={i} className="flex items-start gap-2.5 text-sm text-white/60">
                  <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-red-500/50 shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* ── Profession Insight ── */}
        <div className="mb-8 p-5 rounded-2xl bg-gradient-to-r from-primary-600/8 to-transparent border border-primary-500/10">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary-500/15 flex items-center justify-center shrink-0">
              <svg className="w-4.5 h-4.5 text-primary-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 14.15v4.25c0 1.094-.787 2.036-1.872 2.18-2.087.277-4.216.42-6.378.42s-4.291-.143-6.378-.42c-1.085-.144-1.872-1.086-1.872-2.18v-4.25m16.5 0a2.18 2.18 0 00.75-1.661V8.706c0-1.081-.768-2.015-1.837-2.175a48.114 48.114 0 00-3.413-.387m4.5 8.006c-.194.165-.42.295-.673.38A23.978 23.978 0 0112 15.75c-2.648 0-5.195-.429-7.577-1.22a2.016 2.016 0 01-.673-.38m0 0A2.18 2.18 0 013 12.489V8.706c0-1.081.768-2.015 1.837-2.175a48.111 48.111 0 013.413-.387m7.5 0V5.25A2.25 2.25 0 0013.5 3h-3a2.25 2.25 0 00-2.25 2.25v.894m7.5 0a48.667 48.667 0 00-7.5 0M12 12.75h.008v.008H12v-.008z" />
              </svg>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-primary-400 mb-1">Career &amp; Work</h3>
              <p className="text-sm text-white/60 leading-relaxed">{briefing.professionInsight}</p>
            </div>
          </div>
        </div>

        {/* ── Current Hora + Lucky Stats ── */}
        <div className="grid sm:grid-cols-2 gap-4 mb-8">
          {briefing.currentHora && (
            <div className="p-5 rounded-2xl bg-white/[0.03] border border-white/[0.06]">
              <h3 className="text-xs font-medium text-white/40 uppercase tracking-wider mb-4">Current Hora</h3>
              <div className="flex items-center gap-4">
                <div className={`w-14 h-14 rounded-2xl ${planetIcons[briefing.currentHora.planet]?.bg || "bg-white/[0.06]"} flex items-center justify-center`}>
                  <span className={`text-2xl ${planetIcons[briefing.currentHora.planet]?.color || "text-white/60"}`}>
                    {planetIcons[briefing.currentHora.planet]?.symbol || "\u25cb"}
                  </span>
                </div>
                <div className="flex-1">
                  <p className={`text-lg font-bold ${planetIcons[briefing.currentHora.planet]?.color || "text-white"}`}>
                    {briefing.currentHora.planet}
                  </p>
                  <p className="text-xs text-white/30 mt-0.5">
                    {briefing.currentHora.startTime} – {briefing.currentHora.endTime}
                  </p>
                </div>
              </div>
              <div className="mt-4 pt-3 border-t border-white/[0.06]">
                <p className="text-xs text-white/30 mb-1">Best for</p>
                <div className="flex flex-wrap gap-1.5">
                  {briefing.currentHora.activities.map((a, i) => (
                    <span key={i} className="px-2.5 py-1 rounded-lg bg-white/[0.04] text-[11px] text-white/50">{a}</span>
                  ))}
                </div>
              </div>
            </div>
          )}

          <div className="p-5 rounded-2xl bg-white/[0.03] border border-white/[0.06]">
            <h3 className="text-xs font-medium text-white/40 uppercase tracking-wider mb-4">Lucky Today</h3>
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-pink-500/20 to-orange-500/20 flex items-center justify-center">
                  <div className="w-5 h-5 rounded-full bg-gradient-to-br from-pink-400 to-orange-400" />
                </div>
                <div>
                  <p className="text-[11px] text-white/30 uppercase tracking-wider">Color</p>
                  <p className="text-sm text-white font-medium">{briefing.luckyColor}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-accent-500/10 flex items-center justify-center">
                  <span className="text-accent-400 font-bold text-lg">{briefing.luckyNumber}</span>
                </div>
                <div>
                  <p className="text-[11px] text-white/30 uppercase tracking-wider">Number</p>
                  <p className="text-sm text-white font-medium">{briefing.luckyNumber}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary-500/10 flex items-center justify-center">
                  <svg className="w-5 h-5 text-primary-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <p className="text-[11px] text-white/30 uppercase tracking-wider">Best Time</p>
                  <p className="text-sm text-white font-medium">{briefing.luckyTime}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Planetary Hours Timeline ── */}
        <div className="mb-8 p-5 rounded-2xl bg-white/[0.03] border border-white/[0.06]">
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-xs font-medium text-white/40 uppercase tracking-wider">Planetary Hours</h3>
            <button
              onClick={() => setShowAllHours(!showAllHours)}
              className="text-xs text-primary-400 hover:text-primary-300 transition-colors"
            >
              {showAllHours ? "Show relevant" : "View all 24"}
            </button>
          </div>
          <div className="space-y-1.5">
            {visibleHours.map((hour, i) => {
              const pi = planetIcons[hour.planet] || { symbol: "\u25cb", color: "text-white/60", bg: "bg-white/[0.04]" };
              return (
                <div
                  key={i}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all ${
                    hour.isCurrent
                      ? "bg-primary-600/10 ring-1 ring-primary-500/25"
                      : "hover:bg-white/[0.02]"
                  }`}
                >
                  <div className={`w-8 h-8 rounded-lg ${pi.bg} flex items-center justify-center shrink-0`}>
                    <span className={`text-sm ${pi.color}`}>{pi.symbol}</span>
                  </div>
                  <span className={`text-sm font-medium w-16 ${pi.color}`}>{hour.planet}</span>
                  <span className="text-xs text-white/25 w-28 tabular-nums">
                    {hour.startTime} – {hour.endTime}
                  </span>
                  <span className="text-xs text-white/40 flex-1 hidden sm:block">
                    {hour.activities.slice(0, 2).join(", ")}
                  </span>
                  {hour.isCurrent && (
                    <span className="relative flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary-500/15 text-primary-300">
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary-400 opacity-50" />
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-primary-400" />
                      </span>
                      <span className="text-[10px] font-semibold tracking-wide">NOW</span>
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Panchang ── */}
        <div className="mb-8 p-5 rounded-2xl bg-white/[0.03] border border-white/[0.06]">
          <h3 className="text-xs font-medium text-white/40 uppercase tracking-wider mb-4">Today&apos;s Panchang</h3>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {[
              { label: "Tithi", value: briefing.panchang.tithi, icon: "\ud83c\udf19" },
              { label: "Nakshatra", value: briefing.panchang.nakshatra, icon: "\u2b50" },
              { label: "Yoga", value: briefing.panchang.yoga, icon: "\ud83e\uddd8" },
              { label: "Day", value: briefing.panchang.vara, icon: "\ud83d\udcc5" },
              { label: "Rahu Kaal", value: briefing.panchang.rahukaal, icon: "\u26a0\ufe0f" },
            ].map((item) => (
              <div key={item.label} className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.04] text-center">
                <p className="text-lg mb-1">{item.icon}</p>
                <p className="text-[10px] text-white/30 uppercase tracking-wider mb-1">{item.label}</p>
                <p className="text-xs text-white/70 font-medium">{item.value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ── Remedy & Mantra ── */}
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="p-5 rounded-2xl bg-gradient-to-br from-accent-500/8 to-transparent border border-accent-500/10">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-accent-500/15 flex items-center justify-center shrink-0">
                <svg className="w-4.5 h-4.5 text-accent-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23.693L5 14.5m14.8.8l1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0112 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5" />
                </svg>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-accent-400 mb-1.5">Today&apos;s Remedy</h3>
                <p className="text-sm text-white/60 leading-relaxed">{briefing.remedy}</p>
              </div>
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-gradient-to-br from-primary-600/8 to-accent-500/5 border border-white/[0.06] flex flex-col items-center justify-center text-center">
            <h3 className="text-xs font-medium text-white/40 uppercase tracking-wider mb-3">Today&apos;s Mantra</h3>
            <p className="text-xl sm:text-2xl text-white/90 font-semibold leading-relaxed tracking-wide">
              {briefing.mantra}
            </p>
            <div className="mt-3 w-12 h-px bg-gradient-to-r from-transparent via-accent-500/40 to-transparent" />
          </div>
        </div>
      </div>
    </div>
  );
}
