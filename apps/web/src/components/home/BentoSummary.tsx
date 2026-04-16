'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import { useTranslation } from '@/i18n';

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
  excellent: { emoji: '\u2728', accent: 'from-emerald-500/30', label: 'qualityExcellent' as const, pct: 100, bar: 'bg-emerald-400' },
  good: { emoji: '\u2600\ufe0f', accent: 'from-sky-500/30', label: 'qualityGood' as const, pct: 75, bar: 'bg-sky-400' },
  moderate: { emoji: '\u2696\ufe0f', accent: 'from-amber-500/30', label: 'qualityModerate' as const, pct: 50, bar: 'bg-amber-400' },
  challenging: { emoji: '\ud83c\udf19', accent: 'from-orange-500/30', label: 'qualityChallenging' as const, pct: 25, bar: 'bg-orange-400' },
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

  if (!isAuthenticated) {
    return (
      <section className="mx-auto max-w-6xl px-5 sm:px-8 py-16">
        <div className="flex items-end justify-between mb-8">
          <div>
            <p className="text-[13px] font-medium text-primary-400 uppercase tracking-widest mb-2">
              {t.myDay.luckyToday}
            </p>
            <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
              {t.home.ctaLoggedOut.split('.')[0]}
            </h2>
          </div>
          <Link
            href="/auth?mode=signup"
            className="text-sm text-primary-400 hover:text-primary-300 transition-colors whitespace-nowrap"
          >
            {t.home.ctaButtonLoggedOut} &rarr;
          </Link>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 auto-rows-[140px] gap-4">
          <Link
            href="/auth?mode=signup"
            className="col-span-2 row-span-2 rounded-3xl bg-white/[0.02] border border-white/[0.06] p-8 relative overflow-hidden group hover:border-white/[0.1] transition-all duration-300"
          >
            <div className="absolute -inset-10 bg-gradient-radial from-sky-500/20 via-transparent to-transparent blur-2xl opacity-80 pointer-events-none" />
            <div className="relative z-10 flex flex-col h-full">
              <span className="text-5xl mb-4" aria-hidden>{'\u2600\ufe0f'}</span>
              <p className="text-xs uppercase tracking-widest text-white/30 mb-2">
                {t.myDay.favorableToday}
              </p>
              <h3 className="text-2xl font-bold text-white mb-3">
                {t.home.heroHighlight}
              </h3>
              <p className="text-sm text-white/40 line-clamp-3 flex-1 leading-relaxed">
                {t.home.heroDescription}
              </p>
              <div className="mt-5 w-full h-1 rounded-full bg-white/[0.06] overflow-hidden">
                <div className="h-full w-3/4 rounded-full bg-sky-400" />
              </div>
            </div>
          </Link>

          <div className="rounded-2xl bg-white/[0.02] border border-white/[0.06] p-5 flex flex-col justify-between">
            <p className="text-[11px] uppercase tracking-widest text-white/30">
              {t.myDay.number}
            </p>
            <p className="text-5xl font-bold text-gradient leading-none">
              7
            </p>
          </div>

          <div className="rounded-2xl bg-white/[0.02] border border-white/[0.06] p-5 relative overflow-hidden flex flex-col justify-between">
            <p className="text-[11px] uppercase tracking-widest text-white/30">
              {t.myDay.color}
            </p>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-pink-400 to-orange-400 ring-2 ring-white/10" />
              <p className="text-sm font-medium text-white/70">Saffron</p>
            </div>
          </div>

          <Link
            href="/auth?mode=signup"
            className="col-span-2 rounded-2xl bg-white/[0.02] border border-white/[0.06] p-5 flex items-center gap-5 group hover:border-white/[0.1] transition-all duration-300"
          >
            <div className="w-14 h-14 rounded-2xl bg-primary-500/10 border border-primary-500/20 grid place-items-center shrink-0">
              <span className="text-2xl text-primary-400">{'\u2609'}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] uppercase tracking-widest text-white/30">
                {t.myDay.currentHora}
              </p>
              <p className="text-base font-semibold text-white">Sun</p>
              <p className="text-xs text-white/30 mt-0.5">
                {t.home.ctaButtonLoggedOut}
              </p>
            </div>
          </Link>

          <div className="col-span-2 lg:col-span-4 rounded-2xl bg-white/[0.02] border border-white/[0.06] p-6 relative overflow-hidden text-center">
            <div className="absolute inset-0 bg-gradient-to-r from-primary-600/5 via-accent-500/5 to-primary-600/5" />
            <p className="text-[11px] uppercase tracking-widest text-white/30 mb-2 relative z-10">
              {t.myDay.todaysMantra}
            </p>
            <p className="text-xl sm:text-2xl font-semibold text-white/80 tracking-wide relative z-10">
              {'\u0913\u0902 \u0928\u092e\u0903 \u0936\u093f\u0935\u093e\u092f'}
            </p>
          </div>
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="mx-auto max-w-6xl px-5 sm:px-8 py-16">
        <div className="rounded-3xl bg-white/[0.02] border border-white/[0.06] p-8 text-center text-white/40 text-sm">
          {t.myDay.somethingWrong}
        </div>
      </section>
    );
  }

  if (!briefing) {
    return (
      <section className="mx-auto max-w-6xl px-5 sm:px-8 py-16">
        <div className="grid grid-cols-2 lg:grid-cols-4 auto-rows-[140px] gap-4">
          <div className="col-span-2 row-span-2 rounded-3xl bg-white/[0.02] border border-white/[0.04] animate-pulse" />
          <div className="rounded-2xl bg-white/[0.02] border border-white/[0.04] animate-pulse" />
          <div className="rounded-2xl bg-white/[0.02] border border-white/[0.04] animate-pulse" />
          <div className="col-span-2 rounded-2xl bg-white/[0.02] border border-white/[0.04] animate-pulse" />
          <div className="col-span-2 lg:col-span-4 rounded-2xl bg-white/[0.02] border border-white/[0.04] animate-pulse" />
        </div>
      </section>
    );
  }

  const qs = QUALITY_STYLES[briefing.dayQuality];
  const qualityLabel = (t.myDay as any)[qs.label] ?? briefing.dayQuality;
  const planetKey = briefing.currentHora?.planet ?? '';
  const planetSymbol = PLANET_SYMBOL[planetKey] ?? '\u25cb';

  return (
    <section className="mx-auto max-w-6xl px-5 sm:px-8 py-16">
      <div className="flex items-end justify-between mb-8">
        <div>
          <p className="text-[13px] font-medium text-primary-400 uppercase tracking-widest mb-2">
            {t.myDay.luckyToday}
          </p>
          <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
            {t.home.ctaLoggedIn.split('.')[0]}
          </h2>
        </div>
        <Link
          href="/my-day"
          className="text-sm text-primary-400 hover:text-primary-300 transition-colors whitespace-nowrap"
        >
          {t.home.ctaButtonLoggedIn} &rarr;
        </Link>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 auto-rows-[140px] gap-4">
        <Link
          href="/my-day"
          className="col-span-2 row-span-2 rounded-3xl bg-white/[0.02] border border-white/[0.06] p-8 relative overflow-hidden group hover:border-white/[0.1] transition-all duration-300"
        >
          <div className={`absolute -inset-10 bg-gradient-radial ${qs.accent} via-transparent to-transparent blur-2xl opacity-80 pointer-events-none`} />
          <div className="relative z-10 flex flex-col h-full">
            <span className="text-5xl mb-4" aria-hidden>{qs.emoji}</span>
            <p className="text-xs uppercase tracking-widest text-white/30 mb-2">
              {t.myDay.favorableToday}
            </p>
            <h3 className="text-2xl font-bold text-white mb-3">
              {qualityLabel}
            </h3>
            <p className="text-sm text-white/40 line-clamp-3 flex-1 leading-relaxed">
              {briefing.summary}
            </p>
            <div className="mt-5 w-full h-1 rounded-full bg-white/[0.06] overflow-hidden">
              <div
                className={`h-full rounded-full ${qs.bar} transition-all duration-1000`}
                style={{ width: `${qs.pct}%` }}
              />
            </div>
          </div>
        </Link>

        <div className="rounded-2xl bg-white/[0.02] border border-white/[0.06] p-5 flex flex-col justify-between">
          <p className="text-[11px] uppercase tracking-widest text-white/30">
            {t.myDay.number}
          </p>
          <p className="text-5xl font-bold text-gradient leading-none">
            {briefing.luckyNumber}
          </p>
        </div>

        <div className="rounded-2xl bg-white/[0.02] border border-white/[0.06] p-5 relative overflow-hidden flex flex-col justify-between">
          <p className="text-[11px] uppercase tracking-widest text-white/30">
            {t.myDay.color}
          </p>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-pink-400 to-orange-400 ring-2 ring-white/10" />
            <p className="text-sm font-medium text-white/70">
              {briefing.luckyColor}
            </p>
          </div>
        </div>

        <Link
          href="/my-day"
          className="col-span-2 rounded-2xl bg-white/[0.02] border border-white/[0.06] p-5 flex items-center gap-5 group hover:border-white/[0.1] transition-all duration-300"
        >
          <div className="w-14 h-14 rounded-2xl bg-primary-500/10 border border-primary-500/20 grid place-items-center shrink-0">
            <span className="text-2xl text-primary-400">{planetSymbol}</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[11px] uppercase tracking-widest text-white/30">
              {t.myDay.currentHora}
            </p>
            <p className="text-base font-semibold text-white">
              {briefing.currentHora?.planet ?? '\u2014'}
            </p>
            <p className="text-xs text-white/30 mt-0.5">
              {briefing.currentHora
                ? `${briefing.currentHora.startTime} \u2013 ${briefing.currentHora.endTime}`
                : t.myDay.bestTime}
            </p>
          </div>
        </Link>

        <div className="col-span-2 lg:col-span-4 rounded-2xl bg-white/[0.02] border border-white/[0.06] p-6 relative overflow-hidden text-center">
          <div className="absolute inset-0 bg-gradient-to-r from-primary-600/5 via-accent-500/5 to-primary-600/5" />
          <p className="text-[11px] uppercase tracking-widest text-white/30 mb-2 relative z-10">
            {t.myDay.todaysMantra}
          </p>
          <p className="text-xl sm:text-2xl font-semibold text-white/80 tracking-wide relative z-10">
            {briefing.mantra}
          </p>
        </div>
      </div>
    </section>
  );
}
