"use client";

import React, { useState, useEffect, useLayoutEffect } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { api } from "@/lib/api";
import { useAuthStore, useAuthHydrated } from "@/lib/store";
import { useTranslation } from "@/i18n";
import {
  getQualityLabel,
  translatePlanet,
  translateColor,
  translateActivity,
  translateRemedy,
  translateProfInsight,
  translateTransitAlert,
  translateGreeting,
  translateSummary,
} from "./components/translations";
import { currentHourIndex, minutesSinceMidnight } from "./lib/planetaryTime";
import {
  translateTithi,
  translateNakshatra,
  translateYoga,
  translateVara,
  translateTimeRange,
} from "@/i18n/panchang-terms";

const PlanetaryHoursSection = dynamic(
  () => import("./components/PlanetaryHoursSection").then(m => ({ default: m.PlanetaryHoursSection })),
  { ssr: false },
);

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

const QUALITY_STYLES = {
  excellent: { emoji: "\u2728", color: "text-emerald-400", ring: "ring-emerald-500/30", bg: "bg-emerald-500/10", bar: "bg-emerald-400", glow: "shadow-emerald-500/20", pct: 100 },
  good: { emoji: "\u2600\ufe0f", color: "text-sky-400", ring: "ring-sky-500/30", bg: "bg-sky-500/10", bar: "bg-sky-400", glow: "shadow-sky-500/20", pct: 75 },
  moderate: { emoji: "\u2696\ufe0f", color: "text-amber-400", ring: "ring-amber-500/30", bg: "bg-amber-500/10", bar: "bg-amber-400", glow: "shadow-amber-500/20", pct: 50 },
  challenging: { emoji: "\ud83c\udf19", color: "text-orange-400", ring: "ring-orange-500/30", bg: "bg-orange-500/10", bar: "bg-orange-400", glow: "shadow-orange-500/20", pct: 25 },
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

const LOCALE_MAP: Record<string, string> = {
  en: 'en-IN', hi: 'hi-IN', ta: 'ta-IN', te: 'te-IN', bn: 'bn-IN',
  mr: 'mr-IN', gu: 'gu-IN', kn: 'kn-IN', ml: 'ml-IN', pa: 'pa-IN',
  or: 'or-IN', as: 'as-IN',
};

const TRADITION_BADGE_COLORS: Record<string, string> = {
  VEDIC: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  WESTERN: "bg-sky-500/10 text-sky-400 border-sky-500/20",
  CHINESE: "bg-red-500/10 text-red-400 border-red-500/20",
  HELLENISTIC: "bg-violet-500/10 text-violet-400 border-violet-500/20",
  HORARY: "bg-teal-500/10 text-teal-400 border-teal-500/20",
  MEDICAL: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
};
type TraditionSlug = 'vedic' | 'western' | 'chinese' | 'hellenistic' | 'horary' | 'medical';
const TRADITION_I18N_KEY: Record<string, TraditionSlug> = {
  VEDIC: 'vedic',
  WESTERN: 'western',
  CHINESE: 'chinese',
  HELLENISTIC: 'hellenistic',
  HORARY: 'horary',
  MEDICAL: 'medical',
};

const BRIEFING_CACHE_KEY = 'jyotron-my-day-briefing';

type BriefingCache = {
  date: string; // YYYY-MM-DD of cached entry; expires daily
  locale: string; // cached locale; bust when user switches language
  userId: string; // bust when user switches accounts
  data: DailyBriefing;
};

function readBriefingCache(userId: string, locale: string): DailyBriefing | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(BRIEFING_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as BriefingCache;
    const today = new Date().toISOString().slice(0, 10);
    if (parsed.date !== today) return null;
    if (parsed.locale !== locale) return null;
    if (parsed.userId !== userId) return null;
    return parsed.data;
  } catch { return null; }
}

/**
 * Synchronous cache read used by the useState initializer, so the FIRST
 * client render already has the briefing in hand — no wait for Zustand
 * rehydration or useEffect. We pull userId/locale directly from the
 * persist middleware's localStorage entries instead of routing through
 * the hooks to avoid an extra render cycle on the critical path.
 */
function readBriefingCacheSync(): DailyBriefing | null {
  if (typeof window === 'undefined') return null;
  try {
    const authRaw = window.localStorage.getItem('jyotron-auth');
    const localeRaw = window.localStorage.getItem('jyotron-locale');
    if (!authRaw) return null;
    const userId = JSON.parse(authRaw)?.state?.user?.id;
    if (!userId) return null;
    const loc = (localeRaw && JSON.parse(localeRaw)?.state?.locale) || 'en';
    return readBriefingCache(userId, loc);
  } catch { return null; }
}

function writeBriefingCache(userId: string, locale: string, data: DailyBriefing): void {
  if (typeof window === 'undefined') return;
  try {
    const payload: BriefingCache = {
      date: new Date().toISOString().slice(0, 10),
      locale,
      userId,
      data,
    };
    window.localStorage.setItem(BRIEFING_CACHE_KEY, JSON.stringify(payload));
  } catch { /* quota / private mode */ }
}

export default function MyDayPage() {
  const { t, locale } = useTranslation();
  const router = useRouter();
  const { isAuthenticated, accessToken, user } = useAuthStore();
  const isHydrated = useAuthHydrated();
  const userTraditions: string[] = user?.astrologyTraditions?.length ? user.astrologyTraditions : ["VEDIC", "WESTERN", "CHINESE", "HELLENISTIC", "HORARY", "MEDICAL"];
  const isMultiTradition = userTraditions.length > 1;
  // Start matching SSR (null + loading skeleton) to avoid hydration
  // mismatch warnings; a useLayoutEffect below synchronously swaps in
  // any cached briefing before the browser paints, so returning users
  // effectively skip the skeleton frame.
  const [briefing, setBriefing] = useState<DailyBriefing | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  // Wall-clock minutes-since-midnight, refreshed every 60s so the
  // "Current Hora" card advances through the day even when the cached
  // briefing itself is untouched.
  const [nowMin, setNowMin] = useState(() => minutesSinceMidnight(new Date()));
  useEffect(() => {
    const tick = () => setNowMin(minutesSinceMidnight(new Date()));
    const id = window.setInterval(tick, 60_000);
    return () => window.clearInterval(id);
  }, []);

  // Swap to cached briefing before the first paint on the client.
  // Falls back to useEffect on the server (no-op) via the SSR-safe ref below.
  const useIsoLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;
  useIsoLayoutEffect(() => {
    const cached = readBriefingCacheSync();
    if (cached) {
      setBriefing(cached);
      setLoading(false);
    }
    // No dependency array: this runs exactly once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!isHydrated) return;
    if (!isAuthenticated) {
      router.push("/auth");
      return;
    }
    // Stale-while-revalidate: we already painted today's cache (if any) via
    // the layout effect; now hit the API to pick up any updates. Only show
    // the loading skeleton when we don't have a cached page to avoid the
    // skeleton replacing the content the user is already reading.
    const cached = user?.id ? readBriefingCache(user.id, locale) : null;
    if (cached) {
      // Layout-effect path may have missed this hit (e.g. when the persist
      // middleware seeded the store from somewhere other than localStorage,
      // as in unit tests); keep them in sync.
      setBriefing(cached);
      setLoading(false);
    }
    fetchBriefing(!cached);
  }, [isHydrated, isAuthenticated, locale, user?.id]);

  const fetchBriefing = async (showLoader: boolean) => {
    if (showLoader) setLoading(true);
    setError("");
    try {
      const data = await api.get<DailyBriefing>(`/daily-briefing?locale=${locale}`, { token: accessToken! });
      setBriefing(data);
      if (user?.id) writeBriefingCache(user.id, locale, data);
    } catch (err: any) {
      // If we already rendered cached data, keep it on screen rather than
      // replacing a usable page with an error banner.
      if (showLoader) setError(err.message || t.myDay.loadFailed);
    } finally {
      // Always clear the loading flag — even on background revalidation —
      // so a stale cache hit followed by a successful refresh leaves the
      // page in a coherent state.
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-surface-950" aria-busy="true" aria-live="polite">
        {/* Hero skeleton */}
        <div className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-primary-600/8 via-transparent to-transparent" />
          <div className="relative mx-auto max-w-5xl px-4 pt-8 pb-6 sm:pt-12 sm:pb-10">
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
              <div className="space-y-3">
                <div className="h-3 w-40 rounded bg-white/[0.08] animate-pulse" />
                <div className="h-9 w-72 rounded bg-white/[0.08] animate-pulse" />
              </div>
              <div className="flex items-center gap-3 px-5 py-3 rounded-2xl bg-white/[0.03] ring-1 ring-white/[0.06]">
                <div className="w-8 h-8 rounded-full bg-white/[0.08] animate-pulse" />
                <div className="space-y-2">
                  <div className="h-3 w-16 rounded bg-white/[0.08] animate-pulse" />
                  <div className="h-1 w-24 rounded-full bg-white/[0.06] overflow-hidden">
                    <div className="h-full w-1/2 bg-primary-500/40 animate-pulse" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mx-auto max-w-5xl px-4 pb-16 fade-in-up">
          <div className="relative mb-8 p-6 rounded-2xl bg-gradient-to-br from-white/[0.04] to-white/[0.02] border border-white/[0.06]">
            <div className="absolute top-4 left-4 w-1 h-8 rounded-full bg-gradient-to-b from-primary-500 to-accent-500" />
            <div className="pl-4 space-y-2">
              <div className="h-3 w-full rounded bg-white/[0.08] animate-pulse" />
              <div className="h-3 w-11/12 rounded bg-white/[0.08] animate-pulse" />
              <div className="h-3 w-3/4 rounded bg-white/[0.08] animate-pulse" />
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4 mb-8">
            {[0, 1].map((col) => (
              <div key={col} className="p-5 rounded-2xl bg-white/[0.03] border border-white/[0.06]">
                <div className="flex items-center gap-2.5 mb-4">
                  <div className="w-8 h-8 rounded-lg bg-white/[0.06] animate-pulse" />
                  <div className="h-3 w-32 rounded bg-white/[0.08] animate-pulse" />
                </div>
                <ul className="space-y-2.5">
                  {[0, 1, 2].map((i) => (
                    <li key={i} className="flex items-start gap-2.5">
                      <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-white/[0.2] shrink-0" />
                      <div className="h-3 flex-1 rounded bg-white/[0.06] animate-pulse" />
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div className="p-5 rounded-2xl bg-white/[0.03] border border-white/[0.06]">
            <div className="h-4 w-40 rounded bg-white/[0.08] animate-pulse mb-4" />
            <div className="space-y-3">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-white/[0.06] animate-pulse" />
                    <div className="h-3 w-28 rounded bg-white/[0.06] animate-pulse" />
                  </div>
                  <div className="h-3 w-16 rounded bg-white/[0.06] animate-pulse" />
                </div>
              ))}
            </div>
          </div>

          <p className="sr-only">{t.myDay.readingStars}</p>
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
          <p className="text-red-400 mb-1 text-sm font-medium">{t.myDay.somethingWrong}</p>
          <p className="text-white/40 text-xs mb-5">{error}</p>
          <button onClick={() => fetchBriefing(true)} className="px-6 py-2.5 btn-primary rounded-xl text-sm">{t.myDay.tryAgain}</button>
        </div>
      </div>
    );
  }

  if (!briefing) return null;

  const qs = QUALITY_STYLES[briefing.dayQuality] ?? QUALITY_STYLES.moderate;
  const dateLocale = LOCALE_MAP[locale] || 'en-IN';
  const panchang = briefing.panchang ?? { tithi: '—', nakshatra: '—', yoga: '—', vara: '—', rahukaal: '—' };
  const doList = briefing.doList ?? [];
  const avoidList = briefing.avoidList ?? [];
  const planetaryHours = briefing.planetaryHours ?? [];

  // The daily briefing is cached in localStorage for 24h, so
  // briefing.currentHora is frozen at the hour it was first generated.
  // Derive the live current hora from the wall clock and refresh every
  // minute. Fall back to the server value only when the list is missing
  // or doesn't currently contain "now" (e.g. timezone mismatch).
  const liveHoraIdx = currentHourIndex(planetaryHours, nowMin);
  const liveHora = liveHoraIdx >= 0 ? planetaryHours[liveHoraIdx] : null;
  const currentHora = liveHora ?? briefing.currentHora ?? null;

  return (
    <div className="min-h-screen bg-surface-950">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-primary-600/8 via-transparent to-transparent" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-primary-500/5 rounded-full blur-3xl" />

        <div className="relative mx-auto max-w-5xl px-4 pt-8 pb-6 sm:pt-12 sm:pb-10">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
            <div>
              <p className="text-xs font-medium text-primary-400/80 tracking-widest uppercase mb-2">
                {new Date(briefing.date).toLocaleDateString(dateLocale, { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
              </p>
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white tracking-tight">
                {translateGreeting(briefing.greeting, t)}
              </h1>
              {isMultiTradition && (
                <div className="flex gap-2 mt-3">
                  {userTraditions.map((trad) => {
                    const key = TRADITION_I18N_KEY[trad];
                    const label = key ? t.traditionsUi[key].name : trad;
                    return (
                      <span key={trad} className={`text-[10px] font-medium px-2.5 py-1 rounded-full border ${TRADITION_BADGE_COLORS[trad] || TRADITION_BADGE_COLORS.VEDIC}`}>
                        {label}
                      </span>
                    );
                  })}
                </div>
              )}
            </div>

            <div className={`flex items-center gap-3 px-5 py-3 rounded-2xl ${qs.bg} ring-1 ${qs.ring} self-start sm:self-auto`}>
              <div className="flex flex-col items-center gap-1">
                <span className="text-2xl leading-none">{qs.emoji}</span>
              </div>
              <div>
                <p className={`text-sm font-semibold ${qs.color}`}>{getQualityLabel(briefing.dayQuality, t)}</p>
                <div className="mt-1.5 w-24 h-1 rounded-full bg-white/[0.06] overflow-hidden">
                  <div className={`h-full rounded-full ${qs.bar} transition-all duration-1000`} style={{ width: `${qs.pct}%` }} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-4 pb-16">
        {/* Summary */}
        <div className="relative mb-8 p-6 rounded-2xl bg-gradient-to-br from-white/[0.04] to-white/[0.02] border border-white/[0.06]">
          <div className="absolute top-4 left-4 w-1 h-8 rounded-full bg-gradient-to-b from-primary-500 to-accent-500" />
          <p className="text-white/80 leading-relaxed pl-4 text-[15px]">{translateSummary(briefing.summary, t, locale)}</p>
        </div>

        {/* Transit Alert */}
        {briefing.transitAlert && (
          <div className="mb-8 p-5 rounded-2xl bg-gradient-to-r from-purple-500/8 to-fuchsia-500/5 border border-purple-500/15">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-purple-500/15 flex items-center justify-center shrink-0">
                <svg className="w-4.5 h-4.5 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-semibold text-purple-300 mb-1">{t.myDay.planetaryTransit}</p>
                <p className="text-sm text-purple-200/60 leading-relaxed">{translateTransitAlert(briefing.transitAlert, t)}</p>
              </div>
            </div>
          </div>
        )}

        {/* Do & Avoid */}
        <div className="grid sm:grid-cols-2 gap-4 mb-8">
          <div className="p-5 rounded-2xl bg-white/[0.03] border border-white/[0.06]">
            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                <svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
              </div>
              <h3 className="text-sm font-semibold text-white">{t.myDay.favorableToday}</h3>
            </div>
            <ul className="space-y-2.5">
              {doList.map((item, i) => (
                <li key={i} className="flex items-start gap-2.5 text-sm text-white/60">
                  <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-emerald-500/50 shrink-0" />
                  {translateActivity(item, t)}
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
              <h3 className="text-sm font-semibold text-white">{t.myDay.bestToAvoid}</h3>
            </div>
            <ul className="space-y-2.5">
              {avoidList.map((item, i) => (
                <li key={i} className="flex items-start gap-2.5 text-sm text-white/60">
                  <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-red-500/50 shrink-0" />
                  {translateActivity(item, t)}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Profession Insight */}
        <div className="mb-8 p-5 rounded-2xl bg-gradient-to-r from-primary-600/8 to-transparent border border-primary-500/10">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary-500/15 flex items-center justify-center shrink-0">
              <svg className="w-4.5 h-4.5 text-primary-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 14.15v4.25c0 1.094-.787 2.036-1.872 2.18-2.087.277-4.216.42-6.378.42s-4.291-.143-6.378-.42c-1.085-.144-1.872-1.086-1.872-2.18v-4.25m16.5 0a2.18 2.18 0 00.75-1.661V8.706c0-1.081-.768-2.015-1.837-2.175a48.114 48.114 0 00-3.413-.387m4.5 8.006c-.194.165-.42.295-.673.38A23.978 23.978 0 0112 15.75c-2.648 0-5.195-.429-7.577-1.22a2.016 2.016 0 01-.673-.38m0 0A2.18 2.18 0 013 12.489V8.706c0-1.081.768-2.015 1.837-2.175a48.111 48.111 0 013.413-.387m7.5 0V5.25A2.25 2.25 0 0013.5 3h-3a2.25 2.25 0 00-2.25 2.25v.894m7.5 0a48.667 48.667 0 00-7.5 0M12 12.75h.008v.008H12v-.008z" />
              </svg>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-primary-400 mb-1">{t.myDay.careerWork}</h3>
              <p className="text-sm text-white/60 leading-relaxed">{translateProfInsight(briefing.professionInsight, t)}</p>
            </div>
          </div>
        </div>

        {/* Current Hora + Lucky Stats */}
        <div className="grid sm:grid-cols-2 gap-4 mb-8">
          {currentHora && (
            <div className="p-5 rounded-2xl bg-white/[0.03] border border-white/[0.06]">
              <h3 className="text-xs font-medium text-white/40 uppercase tracking-wider mb-4">{t.myDay.currentHora}</h3>
              <div className="flex items-center gap-4">
                <div className={`w-14 h-14 rounded-2xl ${planetIcons[currentHora.planet]?.bg || "bg-white/[0.06]"} flex items-center justify-center`}>
                  <span className={`text-2xl ${planetIcons[currentHora.planet]?.color || "text-white/60"}`}>
                    {planetIcons[currentHora.planet]?.symbol || "\u25cb"}
                  </span>
                </div>
                <div className="flex-1">
                  <p className={`text-lg font-bold ${planetIcons[currentHora.planet]?.color || "text-white"}`}>
                    {translatePlanet(currentHora.planet, t)}
                  </p>
                  <p className="text-xs text-white/30 mt-0.5">
                    {translateTimeRange(currentHora.startTime, locale)} – {translateTimeRange(currentHora.endTime, locale)}
                  </p>
                </div>
              </div>
              <div className="mt-4 pt-3 border-t border-white/[0.06]">
                <p className="text-xs text-white/30 mb-1">{t.myDay.bestFor}</p>
                <div className="flex flex-wrap gap-1.5">
                  {(currentHora.activities ?? []).map((a, i) => (
                    <span key={i} className="px-2.5 py-1 rounded-lg bg-white/[0.04] text-[11px] text-white/50">{translateActivity(a, t)}</span>
                  ))}
                </div>
              </div>
            </div>
          )}

          <div className="p-5 rounded-2xl bg-white/[0.03] border border-white/[0.06]">
            <h3 className="text-xs font-medium text-white/40 uppercase tracking-wider mb-4">{t.myDay.luckyToday}</h3>
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-pink-500/20 to-orange-500/20 flex items-center justify-center">
                  <div className="w-5 h-5 rounded-full bg-gradient-to-br from-pink-400 to-orange-400" />
                </div>
                <div>
                  <p className="text-[11px] text-white/30 uppercase tracking-wider">{t.myDay.color}</p>
                  <p className="text-sm text-white font-medium">{translateColor(briefing.luckyColor, t)}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-accent-500/10 flex items-center justify-center">
                  <span className="text-accent-400 font-bold text-lg">{briefing.luckyNumber}</span>
                </div>
                <div>
                  <p className="text-[11px] text-white/30 uppercase tracking-wider">{t.myDay.number}</p>
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
                  <p className="text-[11px] text-white/30 uppercase tracking-wider">{t.myDay.bestTime}</p>
                  <p className="text-sm text-white font-medium">{translateTimeRange(briefing.luckyTime, locale)}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Planetary Hours Timeline (lazy loaded) */}
        <PlanetaryHoursSection planetaryHours={planetaryHours} t={t} locale={locale} />

        {/* Panchang */}
        <div className="mb-8 p-5 rounded-2xl bg-white/[0.03] border border-white/[0.06]">
          <h3 className="text-xs font-medium text-white/40 uppercase tracking-wider mb-4">{t.myDay.todaysPanchang}</h3>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {[
              { label: t.myDay.tithi, value: translateTithi(panchang.tithi, locale), icon: "\ud83c\udf19" },
              { label: t.myDay.nakshatraLabel, value: translateNakshatra(panchang.nakshatra, locale), icon: "\u2b50" },
              { label: t.myDay.yoga, value: translateYoga(panchang.yoga, locale), icon: "\ud83e\uddd8" },
              { label: t.myDay.day, value: translateVara(panchang.vara, locale), icon: "\ud83d\udcc5" },
              { label: t.myDay.rahuKaal, value: translateTimeRange(panchang.rahukaal, locale), icon: "\u26a0\ufe0f" },
            ].map((item) => (
              <div key={item.label} className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.04] text-center">
                <p className="text-lg mb-1">{item.icon}</p>
                <p className="text-[10px] text-white/30 uppercase tracking-wider mb-1">{item.label}</p>
                <p className="text-xs text-white/70 font-medium">{item.value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Remedy & Mantra */}
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="p-5 rounded-2xl bg-gradient-to-br from-accent-500/8 to-transparent border border-accent-500/10">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-accent-500/15 flex items-center justify-center shrink-0">
                <svg className="w-4.5 h-4.5 text-accent-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23.693L5 14.5m14.8.8l1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0112 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5" />
                </svg>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-accent-400 mb-1.5">{t.myDay.todaysRemedy}</h3>
                <p className="text-sm text-white/60 leading-relaxed">{translateRemedy(briefing.remedy, t)}</p>
              </div>
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-gradient-to-br from-primary-600/8 to-accent-500/5 border border-white/[0.06] flex flex-col items-center justify-center text-center">
            <h3 className="text-xs font-medium text-white/40 uppercase tracking-wider mb-3">{t.myDay.todaysMantra}</h3>
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
