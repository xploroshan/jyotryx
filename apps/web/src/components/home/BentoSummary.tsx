'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import { useTranslation } from '@/i18n';

/**
 * Bento-style summary block on the home page. Pulls the same
 * `/daily-briefing` payload the My Day page uses and renders a
 * compact, asymmetric 4×3 grid (2×2 hero + 4 small tiles + mantra
 * strip). Logged-in users only — gated by the caller.
 */
interface DailyBriefing {
  greeting: string;
  date: string;
  dayQuality: 'excellent' | 'good' | 'moderate' | 'challenging';
  summary: string;
  doList: string[];
  avoidList: string[];
  planetaryHours: Array<{
    planet: string;
    startTime: string;
    endTime: string;
    isCurrent: boolean;
  }>;
  currentHora: {
    planet: string;
    startTime: string;
    endTime: string;
  } | null;
  luckyColor: string;
  luckyNumber: number;
  luckyTime: string;
  remedy: string;
  mantra: string;
  panchang: {
    tithi: string;
    nakshatra: string;
    yoga: string;
    vara: string;
    rahukaal: string;
  };
}

const QUALITY_STYLES = {
  excellent: { emoji: '\u2728', accent: 'from-emerald-500/35 via-emerald-500/10 to-transparent', label: 'qualityExcellent' as const, pct: 100, bar: 'bg-emerald-400' },
  good: { emoji: '\u2600\ufe0f', accent: 'from-sky-500/35 via-sky-500/10 to-transparent', label: 'qualityGood' as const, pct: 75, bar: 'bg-sky-400' },
  moderate: { emoji: '\u2696\ufe0f', accent: 'from-amber-500/35 via-amber-500/10 to-transparent', label: 'qualityModerate' as const, pct: 50, bar: 'bg-amber-400' },
  challenging: { emoji: '\ud83c\udf19', accent: 'from-orange-500/35 via-orange-500/10 to-transparent', label: 'qualityChallenging' as const, pct: 25, bar: 'bg-orange-400' },
};

const PLANET_SYMBOL: Record<string, string> = {
  Sun: '\u2609', Moon: '\u263d', Mars: '\u2642', Mercury: '\u263f',
  Jupiter: '\u2643', Venus: '\u2640', Saturn: '\u2644',
};

export default function BentoSummary() {
  const { t, locale } = useTranslation();
  const { accessToken, isAuthenticated } = useAuthStore();
  const [briefing, setBriefing] = useState<DailyBriefing | null>(null);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    if (!isAuthenticated || !accessToken) return;
    let cancelled = false;
    api
      .get<DailyBriefing>(`/daily-briefing?locale=${locale}`, { token: accessToken })
      .then((data) => { if (!cancelled) setBriefing(data); })
      .catch(() => { if (!cancelled) setError('failed'); });
    return () => { cancelled = true; };
  }, [isAuthenticated, accessToken, locale]);

  if (!isAuthenticated) return null;

  if (error) {
    return (
      <section className="mx-auto max-w-6xl px-4 py-10">
        <div className="glass rounded-3xl p-6 text-center text-white/50 text-sm">
          {t.myDay.somethingWrong}
        </div>
      </section>
    );
  }

  if (!briefing) {
    // Skeleton that matches the bento shape
    return (
      <section className="mx-auto max-w-6xl px-4 py-10">
        <div className="grid grid-cols-2 lg:grid-cols-4 auto-rows-[120px] gap-3">
          <div className="col-span-2 row-span-2 glass rounded-3xl animate-pulse" />
          <div className="glass rounded-2xl animate-pulse" />
          <div className="glass rounded-2xl animate-pulse" />
          <div className="col-span-2 glass rounded-2xl animate-pulse" />
          <div className="col-span-2 lg:col-span-4 glass rounded-2xl animate-pulse" />
        </div>
      </section>
    );
  }

  const qs = QUALITY_STYLES[briefing.dayQuality];
  const qualityLabel = (t.myDay as any)[qs.label] ?? briefing.dayQuality;
  const planetKey = briefing.currentHora?.planet ?? '';
  const planetSymbol = PLANET_SYMBOL[planetKey] ?? '\u25cb';

  return (
    <section className="mx-auto max-w-6xl px-4 py-10">
      <div className="flex items-end justify-between mb-5">
        <div>
          <p className="text-[11px] font-semibold tracking-widest uppercase text-primary-400/80 mb-1">
            {t.myDay.luckyToday}
          </p>
          <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
            {t.home.ctaLoggedIn.split('.')[0]}
          </h2>
        </div>
        <Link
          href="/my-day"
          className="text-xs text-primary-400 hover:text-primary-300 transition-colors whitespace-nowrap"
        >
          {t.home.ctaButtonLoggedIn} →
        </Link>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 auto-rows-[120px] gap-3">
        {/* Hero tile — day quality */}
        <Link
          href="/my-day"
          className="col-span-2 row-span-2 glass-strong rounded-3xl p-6 relative overflow-hidden group"
        >
          <div className={`absolute -inset-10 bg-gradient-radial ${qs.accent} blur-2xl opacity-80 pointer-events-none`} />
          <div className="relative z-10 flex flex-col h-full">
            <span className="text-5xl mb-3" aria-hidden>{qs.emoji}</span>
            <p className="text-xs uppercase tracking-widest text-white/40 mb-1">
              {t.myDay.favorableToday}
            </p>
            <h3 className="text-xl sm:text-2xl font-bold text-white mb-2">
              {qualityLabel}
            </h3>
            <p className="text-sm text-white/60 line-clamp-3 flex-1">
              {briefing.summary}
            </p>
            <div className="mt-4 w-full h-1 rounded-full bg-white/[0.06] overflow-hidden">
              <div
                className={`h-full rounded-full ${qs.bar} transition-all duration-1000`}
                style={{ width: `${qs.pct}%` }}
              />
            </div>
          </div>
        </Link>

        {/* Lucky number */}
        <div className="glass rounded-2xl p-4 flex flex-col justify-between">
          <p className="text-[10px] uppercase tracking-widest text-white/40">
            {t.myDay.number}
          </p>
          <p className="text-5xl font-bold bg-gradient-to-br from-accent-300 to-primary-400 bg-clip-text text-transparent leading-none">
            {briefing.luckyNumber}
          </p>
        </div>

        {/* Lucky color */}
        <div className="glass rounded-2xl p-4 relative overflow-hidden flex flex-col justify-between">
          <p className="text-[10px] uppercase tracking-widest text-white/40">
            {t.myDay.color}
          </p>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-pink-400 to-orange-400 ring-2 ring-white/20" />
            <p className="text-sm font-medium text-white/80 truncate">
              {briefing.luckyColor}
            </p>
          </div>
        </div>

        {/* Current Hora (col-span-2 on mobile/desktop) */}
        <Link
          href="/my-day"
          className="col-span-2 glass rounded-2xl p-4 flex items-center gap-4 group hover:bg-white/[0.06] transition"
        >
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary-500/20 to-accent-500/10 grid place-items-center shrink-0">
            <span className="text-2xl text-primary-300">{planetSymbol}</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] uppercase tracking-widest text-white/40">
              {t.myDay.currentHora}
            </p>
            <p className="text-sm font-semibold text-white truncate">
              {briefing.currentHora?.planet ?? '\u2014'}
            </p>
            <p className="text-[11px] text-white/40">
              {briefing.currentHora
                ? `${briefing.currentHora.startTime} \u2013 ${briefing.currentHora.endTime}`
                : t.myDay.bestTime}
            </p>
          </div>
        </Link>

        {/* Mantra strip (full width) */}
        <div className="col-span-2 lg:col-span-4 glass-strong rounded-2xl p-5 relative overflow-hidden text-center">
          <div className="absolute inset-0 bg-gradient-to-r from-primary-600/10 via-accent-500/10 to-primary-600/10 opacity-60" />
          <p className="text-[10px] uppercase tracking-widest text-white/40 mb-1 relative z-10">
            {t.myDay.todaysMantra}
          </p>
          <p className="text-lg sm:text-2xl font-semibold text-white tracking-wide relative z-10">
            {briefing.mantra}
          </p>
        </div>
      </div>
    </section>
  );
}
