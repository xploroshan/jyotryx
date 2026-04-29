'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import { useTranslation } from '@/i18n';
import { translateColorName, translatePlanetName, translateTimeRange } from '@/i18n/panchang-terms';
import { translateSummary } from '@/app/my-day/components/translations';
import { Stagger } from '@/components/ui/PageTransition';
import { Skeleton } from '@/components/ui/Skeleton';

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
  excellent: { emoji: '\u2728', wash: 'sunrise', label: 'qualityExcellent' as const, pct: 100, bar: 'bg-primary-500' },
  good: { emoji: '\u2600\ufe0f', wash: 'sunrise', label: 'qualityGood' as const, pct: 75, bar: 'bg-primary-400' },
  moderate: { emoji: '\u2696\ufe0f', wash: 'amber', label: 'qualityModerate' as const, pct: 50, bar: 'bg-amber-500' },
  challenging: { emoji: '\ud83c\udf19', wash: 'amber', label: 'qualityChallenging' as const, pct: 25, bar: 'bg-amber-600' },
} as const;

const QUALITY_WASH = {
  sunrise:
    'radial-gradient(circle at 30% 30%, rgba(255,182,39,0.20) 0%, rgba(255,77,0,0.10) 45%, transparent 75%)',
  amber:
    'radial-gradient(circle at 30% 30%, rgba(245,158,11,0.16) 0%, rgba(184,76,4,0.08) 45%, transparent 75%)',
} as const;

// Detect Latin-script copy so we only italicise the mantra accent for
// languages where italic is a typographic norm \u2014 Devanagari, Tamil, etc.
// stay roman.
function isLatinScript(text: string): boolean {
  return /^[\p{Script=Latin}\s\d.,;:'"\-\u2014\u2013!?]+$/u.test(text.trim());
}

const PLANET_SYMBOL: Record<string, string> = {
  Sun: '\u2609', Moon: '\u263d', Mars: '\u2642', Mercury: '\u263f',
  Jupiter: '\u2643', Venus: '\u2640', Saturn: '\u2644',
};

// Shared cache key with /my-day so visiting one warms the other.
const BRIEFING_CACHE_KEY = 'jyotron-my-day-briefing';

function readSharedBriefingCache(userId: string, locale: string): DailyBriefing | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(BRIEFING_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const today = new Date().toISOString().slice(0, 10);
    if (parsed.date !== today || parsed.locale !== locale || parsed.userId !== userId) return null;
    return parsed.data as DailyBriefing;
  } catch { return null; }
}

export default function BentoSummary() {
  const { t, locale } = useTranslation();
  const { accessToken, isAuthenticated, user } = useAuthStore();
  const [briefing, setBriefing] = useState<DailyBriefing | null>(null);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    if (!isAuthenticated || !accessToken) return;
    // Stale-while-revalidate: paint cached briefing if /my-day already
    // populated it today, then revalidate in the background.
    const cached = user?.id ? readSharedBriefingCache(user.id, locale) : null;
    if (cached) setBriefing(cached);
    let cancelled = false;
    api
      .get<DailyBriefing>(`/daily-briefing?locale=${locale}`, { token: accessToken })
      .then((data) => { if (!cancelled) setBriefing(data); })
      .catch(() => { if (!cancelled && !cached) setError('failed'); });
    return () => { cancelled = true; };
  }, [isAuthenticated, accessToken, locale, user?.id]);

  if (!isAuthenticated) {
    const sampleMantra = '\u0913\u0902 \u0928\u092e\u0903 \u0936\u093f\u0935\u093e\u092f';
    return (
      <section className="mx-auto max-w-6xl px-5 sm:px-8 py-20 sm:py-28">
        <div className="flex items-end justify-between mb-10">
          <div>
            <p className="text-[12px] font-medium text-primary-700 uppercase tracking-[0.22em] mb-3">
              {t.myDay.luckyToday}
            </p>
            <h2
              className="font-display font-semibold text-surface-900 tracking-[-0.01em] leading-[1.0]"
              style={{ fontSize: 'clamp(28px, 3.6vw, 52px)' }}
            >
              {t.home.ctaLoggedOut.split('.')[0]}
            </h2>
          </div>
          <Link
            href="/auth?mode=signup"
            className="group inline-flex items-center gap-2 text-sm font-semibold text-primary-700 hover:text-primary-800 transition-colors whitespace-nowrap"
          >
            {t.home.ctaButtonLoggedOut}
            <span aria-hidden className="inline-block transition-transform group-hover:translate-x-1">
              &rarr;
            </span>
          </Link>
        </div>

        <Stagger.Container className="grid grid-cols-2 lg:grid-cols-4 auto-rows-[150px] gap-4 sm:gap-5">
          {/* Hero card \u2014 favorable today */}
          <Stagger.Item className="col-span-2 row-span-2">
            <Link
              href="/auth?mode=signup"
              className="h-full block rounded-3xl bg-surface-50 border border-surface-900/[0.08] shadow-warm-lg p-8 relative overflow-hidden group hover:-translate-y-1 transition-all duration-300"
            >
              <div
                className="absolute -inset-10 blur-2xl opacity-90 pointer-events-none"
                style={{ background: QUALITY_WASH.sunrise }}
              />
              <div className="relative z-10 flex flex-col h-full">
                <span className="text-5xl mb-4" aria-hidden>{'\u2600\ufe0f'}</span>
                <p className="text-[11px] uppercase tracking-[0.22em] text-surface-900/55 mb-3">
                  {t.myDay.favorableToday}
                </p>
                <h3
                  className="font-display font-semibold text-surface-900 mb-4 leading-[1.05] tracking-[-0.01em]"
                  style={{ fontSize: 'clamp(28px, 3.4vw, 44px)' }}
                >
                  <span className="serif-italic accent-underline text-gradient-sunrise">
                    {t.home.heroHighlight}
                  </span>
                </h3>
                <p className="text-sm text-secondary line-clamp-3 flex-1 leading-relaxed">
                  {t.home.heroDescription}
                </p>
                <div className="mt-5 w-full h-1 rounded-full bg-surface-900/[0.06] overflow-hidden">
                  <div className="h-full w-3/4 rounded-full bg-primary-500" />
                </div>
              </div>
            </Link>
          </Stagger.Item>

          {/* Lucky number \u2014 oversized serif numeral */}
          <Stagger.Item className="rounded-2xl bg-surface-50 border border-surface-900/[0.08] shadow-warm-sm p-5 flex flex-col justify-between hover:-translate-y-0.5 hover:shadow-warm-lg transition-all duration-300">
            <p className="text-[11px] uppercase tracking-[0.22em] text-surface-900/55">
              {t.myDay.number}
            </p>
            <p
              className="font-display font-semibold text-gradient-sunrise leading-[0.85] tabular-nums"
              style={{ fontSize: 'clamp(72px, 11vw, 140px)' }}
            >
              7
            </p>
          </Stagger.Item>

          {/* Lucky color */}
          <Stagger.Item className="rounded-2xl bg-surface-50 border border-surface-900/[0.08] shadow-warm-sm p-5 relative overflow-hidden flex flex-col justify-between hover:-translate-y-0.5 hover:shadow-warm-lg transition-all duration-300">
            <p className="text-[11px] uppercase tracking-[0.22em] text-surface-900/55">
              {t.myDay.color}
            </p>
            <div className="flex items-center gap-3">
              <div
                className="w-9 h-9 rounded-full ring-2 ring-surface-900/10 shrink-0"
                style={{
                  background: 'linear-gradient(135deg, #FFB627 0%, #FF7A40 50%, #FF4D00 100%)',
                }}
              />
              <p className="font-display text-lg font-semibold text-surface-900">Saffron</p>
            </div>
          </Stagger.Item>

          {/* Current hora */}
          <Stagger.Item className="col-span-2">
            <Link
              href="/auth?mode=signup"
              className="h-full rounded-2xl bg-surface-50 border border-surface-900/[0.08] shadow-warm-sm p-5 flex items-center gap-5 group hover:-translate-y-0.5 hover:shadow-warm-lg transition-all duration-300"
            >
              <div className="w-14 h-14 rounded-2xl bg-primary-500/10 border border-primary-500/20 grid place-items-center shrink-0">
                <span className="text-2xl text-primary-700">{'\u2609'}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[11px] uppercase tracking-[0.22em] text-surface-900/55">
                  {t.myDay.currentHora}
                </p>
                <p className="font-display text-lg font-semibold text-surface-900">Sun</p>
                <p className="text-xs text-surface-900/55 mt-0.5">
                  {t.home.ctaButtonLoggedOut}
                </p>
              </div>
            </Link>
          </Stagger.Item>

          {/* Mantra \u2014 italic serif on Latin scripts only */}
          <Stagger.Item className="col-span-2 lg:col-span-4 rounded-2xl bg-surface-50 border border-surface-900/[0.08] shadow-warm-sm p-8 sm:p-10 relative overflow-hidden text-center">
            <div
              className="absolute inset-0 pointer-events-none"
              style={{ background: QUALITY_WASH.sunrise, opacity: 0.5 }}
            />
            <p className="text-[11px] uppercase tracking-[0.22em] text-surface-900/55 mb-3 relative z-10">
              {t.myDay.todaysMantra}
            </p>
            <p
              className={`font-display tracking-wide relative z-10 text-surface-900 ${
                isLatinScript(sampleMantra) ? 'serif-italic' : 'font-medium'
              }`}
              style={{ fontSize: 'clamp(22px, 3vw, 36px)' }}
            >
              {sampleMantra}
            </p>
          </Stagger.Item>
        </Stagger.Container>
      </section>
    );
  }

  if (error) {
    return (
      <section className="mx-auto max-w-6xl px-5 sm:px-8 py-16">
        <div className="rounded-3xl bg-surface-900/[0.02] border border-surface-900/[0.06] p-8 text-center text-surface-900/40 text-sm">
          {t.myDay.somethingWrong}
        </div>
      </section>
    );
  }

  if (!briefing) {
    return (
      <section className="mx-auto max-w-6xl px-5 sm:px-8 py-16" aria-busy="true" aria-live="polite">
        <div className="grid grid-cols-2 lg:grid-cols-4 auto-rows-[140px] gap-4">
          <Skeleton rounded="rounded-3xl" className="col-span-2 row-span-2 border border-surface-900/[0.04]" />
          <Skeleton rounded="rounded-2xl" className="border border-surface-900/[0.04]" />
          <Skeleton rounded="rounded-2xl" className="border border-surface-900/[0.04]" />
          <Skeleton rounded="rounded-2xl" className="col-span-2 border border-surface-900/[0.04]" />
          <Skeleton rounded="rounded-2xl" className="col-span-2 lg:col-span-4 border border-surface-900/[0.04]" />
        </div>
      </section>
    );
  }

  const qs = QUALITY_STYLES[briefing.dayQuality];
  const qualityLabel = (t.myDay as any)[qs.label] ?? briefing.dayQuality;
  const planetKey = briefing.currentHora?.planet ?? '';
  const planetSymbol = PLANET_SYMBOL[planetKey] ?? '\u25cb';
  const wash = QUALITY_WASH[qs.wash];

  return (
    <section className="mx-auto max-w-6xl px-5 sm:px-8 py-20 sm:py-28">
      <div className="flex items-end justify-between mb-10">
        <div>
          <p className="text-[12px] font-medium text-primary-700 uppercase tracking-[0.22em] mb-3">
            {t.myDay.luckyToday}
          </p>
          <h2
            className="font-display font-semibold text-surface-900 tracking-[-0.01em] leading-[1.0]"
            style={{ fontSize: 'clamp(28px, 3.6vw, 52px)' }}
          >
            {t.home.ctaLoggedIn.split('.')[0]}
          </h2>
        </div>
        <Link
          href="/my-day"
          className="group inline-flex items-center gap-2 text-sm font-semibold text-primary-700 hover:text-primary-800 transition-colors whitespace-nowrap"
        >
          {t.home.ctaButtonLoggedIn}
          <span aria-hidden className="inline-block transition-transform group-hover:translate-x-1">
            &rarr;
          </span>
        </Link>
      </div>

      <Stagger.Container className="grid grid-cols-2 lg:grid-cols-4 auto-rows-[150px] gap-4 sm:gap-5">
        <Stagger.Item className="col-span-2 row-span-2">
          <Link
            href="/my-day"
            className="h-full block rounded-3xl bg-surface-50 border border-surface-900/[0.08] shadow-warm-lg p-8 relative overflow-hidden group hover:-translate-y-1 transition-all duration-300"
          >
            <div
              className="absolute -inset-10 blur-2xl opacity-90 pointer-events-none"
              style={{ background: wash }}
            />
            <div className="relative z-10 flex flex-col h-full">
              <span className="text-5xl mb-4" aria-hidden>{qs.emoji}</span>
              <p className="text-[11px] uppercase tracking-[0.22em] text-surface-900/55 mb-3">
                {t.myDay.favorableToday}
              </p>
              <h3
                className="font-display font-semibold text-surface-900 mb-4 leading-[1.05] tracking-[-0.01em]"
                style={{ fontSize: 'clamp(28px, 3.4vw, 44px)' }}
              >
                {qualityLabel}
              </h3>
              <p className="text-sm text-secondary line-clamp-3 flex-1 leading-relaxed">
                {translateSummary(briefing.summary, t, locale)}
              </p>
              <div className="mt-5 w-full h-1 rounded-full bg-surface-900/[0.06] overflow-hidden">
                <div
                  className={`h-full rounded-full ${qs.bar} transition-all duration-1000`}
                  style={{ width: `${qs.pct}%` }}
                />
              </div>
            </div>
          </Link>
        </Stagger.Item>

        <Stagger.Item className="rounded-2xl bg-surface-50 border border-surface-900/[0.08] shadow-warm-sm p-5 flex flex-col justify-between hover:-translate-y-0.5 hover:shadow-warm-lg transition-all duration-300">
          <p className="text-[11px] uppercase tracking-[0.22em] text-surface-900/55">
            {t.myDay.number}
          </p>
          <p
            className="font-display font-semibold text-gradient-sunrise leading-[0.85] tabular-nums"
            style={{ fontSize: 'clamp(72px, 11vw, 140px)' }}
          >
            {briefing.luckyNumber}
          </p>
        </Stagger.Item>

        <Stagger.Item className="rounded-2xl bg-surface-50 border border-surface-900/[0.08] shadow-warm-sm p-5 relative overflow-hidden flex flex-col justify-between hover:-translate-y-0.5 hover:shadow-warm-lg transition-all duration-300">
          <p className="text-[11px] uppercase tracking-[0.22em] text-surface-900/55">
            {t.myDay.color}
          </p>
          <div className="flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-full ring-2 ring-surface-900/10 shrink-0"
              style={{
                background: 'linear-gradient(135deg, #FFB627 0%, #FF7A40 50%, #FF4D00 100%)',
              }}
            />
            <p className="font-display text-lg font-semibold text-surface-900">
              {translateColorName(briefing.luckyColor, locale)}
            </p>
          </div>
        </Stagger.Item>

        <Stagger.Item className="col-span-2">
          <Link
            href="/my-day"
            className="h-full rounded-2xl bg-surface-50 border border-surface-900/[0.08] shadow-warm-sm p-5 flex items-center gap-5 group hover:-translate-y-0.5 hover:shadow-warm-lg transition-all duration-300"
          >
            <div className="w-14 h-14 rounded-2xl bg-primary-500/10 border border-primary-500/20 grid place-items-center shrink-0">
              <span className="text-2xl text-primary-700">{planetSymbol}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] uppercase tracking-[0.22em] text-surface-900/55">
                {t.myDay.currentHora}
              </p>
              <p className="font-display text-lg font-semibold text-surface-900">
                {briefing.currentHora ? translatePlanetName(briefing.currentHora.planet, locale) : '\u2014'}
              </p>
              <p className="text-xs text-surface-900/55 mt-0.5">
                {briefing.currentHora
                  ? `${translateTimeRange(briefing.currentHora.startTime, locale)} \u2013 ${translateTimeRange(briefing.currentHora.endTime, locale)}`
                  : t.myDay.bestTime}
              </p>
            </div>
          </Link>
        </Stagger.Item>

        <Stagger.Item className="col-span-2 lg:col-span-4 rounded-2xl bg-surface-50 border border-surface-900/[0.08] shadow-warm-sm p-8 sm:p-10 relative overflow-hidden text-center">
          <div
            className="absolute inset-0 pointer-events-none"
            style={{ background: wash, opacity: 0.5 }}
          />
          <p className="text-[11px] uppercase tracking-[0.22em] text-surface-900/55 mb-3 relative z-10">
            {t.myDay.todaysMantra}
          </p>
          <p
            className={`font-display tracking-wide relative z-10 text-surface-900 ${
              isLatinScript(briefing.mantra) ? 'serif-italic' : 'font-medium'
            }`}
            style={{ fontSize: 'clamp(22px, 3vw, 36px)' }}
          >
            {briefing.mantra}
          </p>
        </Stagger.Item>
      </Stagger.Container>
    </section>
  );
}
