'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useTranslation } from '@/i18n';
import { useAuthStore } from '@/lib/store';
import { api } from '@/lib/api';
import { WEB_TRADITIONS } from '@/lib/traditions';

interface DashaPeriod {
  planet: string;
  startDate: string;
  endDate: string;
  subPeriods?: { planet: string; startDate: string; endDate: string }[];
}

interface KundliLite {
  id: string;
  dashas: DashaPeriod[];
}

const PLANET_EMOJI: Record<string, string> = {
  Sun: '☉',
  Moon: '☽',
  Mars: '♂',
  Mercury: '☿',
  Jupiter: '♃',
  Venus: '♀',
  Saturn: '♄',
  Rahu: '☊',
  Ketu: '☋',
};

function fmtDate(s: string): string {
  try {
    const d = new Date(s);
    if (isNaN(d.getTime())) return s;
    return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  } catch {
    return s;
  }
}

/**
 * Vimshottari Dasha periods — Vedic feature page.
 *
 * Generates the full Kundli via `POST /astrology/kundli` (the dashas
 * list is returned alongside the chart) and renders the 9-planet
 * Vimshottari cycle with expandable antardashas (sub-periods).
 * Highlights the currently-active period.
 */
export default function VedicDashaPage() {
  const { t, locale } = useTranslation();
  const fp = t.featurePages.vedicDasha;
  const { isAuthenticated, user } = useAuthStore();
  const cfg = WEB_TRADITIONS.VEDIC;

  const [data, setData] = useState<KundliLite | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);

  const hasBirth = Boolean(
    user?.dateOfBirth && user?.timeOfBirth && user?.placeOfBirth,
  );

  useEffect(() => {
    if (!isAuthenticated || !hasBirth) return;
    let cancelled = false;
    setLoading(true);
    setError('');
    api
      .post<KundliLite>('/astrology/kundli', {
        dateOfBirth: user!.dateOfBirth,
        timeOfBirth: user!.timeOfBirth,
        placeOfBirth: user!.placeOfBirth,
        locale,
        tradition: 'VEDIC',
      })
      .then((res) => {
        if (!cancelled) setData(res);
      })
      .catch((err: any) => {
        if (!cancelled) setError(err?.message || t.kundli.generateFailed);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, hasBirth, user, locale, t.kundli.generateFailed]);

  const currentDashaIdx = useMemo(() => {
    if (!data?.dashas) return -1;
    const now = Date.now();
    return data.dashas.findIndex((d) => {
      const s = new Date(d.startDate).getTime();
      const e = new Date(d.endDate).getTime();
      return now >= s && now <= e;
    });
  }, [data]);

  const featureName = (t as any).traditionsUi?.vedic?.features?.dasha || 'Dasha Periods';
  const traditionName = (t as any).traditionsUi?.vedic?.name || 'Vedic';

  return (
    <div className="mx-auto max-w-4xl px-5 sm:px-8 py-8 pt-4 fade-in-up">
      <nav className="mb-5 text-sm text-[rgba(12,8,5,0.46)]">
        <Link href={`/${cfg.slug}`} className="hover:text-surface-950 transition-colors">
          {traditionName}
        </Link>{' '}
        <span className="text-[rgba(12,8,5,0.32)]">/</span>{' '}
        <span className="text-secondary">{featureName}</span>
      </nav>

      <section
        className={`rounded-3xl bg-gradient-to-br ${cfg.heroClass} border border-[rgba(12,8,5,0.08)] px-8 sm:px-10 py-10 mb-8`}
      >
        <div className="flex items-center gap-5">
          <span className="text-4xl leading-none" aria-hidden>
            🌀
          </span>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-surface-950 tracking-tight">
              {featureName}
            </h1>
            <p className="mt-2 text-sm text-[rgba(12,8,5,0.55)] leading-relaxed">
              {t.kundli.dashaPeriods} — {fp.description}
            </p>
          </div>
        </div>
      </section>

      {!isAuthenticated && (
        <div className="rounded-2xl bg-[rgba(255,252,245,0.70)] border border-[rgba(12,8,5,0.08)] p-10 text-center">
          <p className="text-[rgba(12,8,5,0.55)] mb-5">{t.kundli.loginRequired}</p>
          <Link
            href="/auth?mode=login"
            className="inline-block px-6 py-2.5 btn-primary rounded-full text-sm"
          >
            {t.common.login}
          </Link>
        </div>
      )}

      {isAuthenticated && !hasBirth && (
        <div className="rounded-2xl bg-[rgba(255,252,245,0.70)] border border-[rgba(12,8,5,0.08)] p-10 text-center">
          <p className="text-[rgba(12,8,5,0.55)] mb-5">{t.kundli.doshaComplete}</p>
          <Link
            href="/profile"
            className="inline-block px-6 py-2.5 btn-primary rounded-full text-sm"
          >
            {fp.profile}
          </Link>
        </div>
      )}

      {isAuthenticated && hasBirth && loading && (
        <div className="rounded-2xl bg-[rgba(255,252,245,0.70)] border border-[rgba(12,8,5,0.08)] p-10 text-center text-[rgba(12,8,5,0.46)] text-sm">
          {t.common.loading}
        </div>
      )}

      {error && (
        <div className="rounded-2xl bg-red-500/5 border border-red-500/20 p-6 text-center text-red-300 text-sm">
          {error}
        </div>
      )}

      {data?.dashas && data.dashas.length > 0 && (
        <div className="space-y-3">
          {data.dashas.map((d, i) => {
            const isCurrent = i === currentDashaIdx;
            const isOpen = expandedIdx === i;
            return (
              <div
                key={i}
                className={`rounded-2xl bg-[rgba(255,252,245,0.70)] border overflow-hidden transition-all duration-300 ${
                  isCurrent
                    ? 'border-primary-500/30 shadow-[0_0_24px_-4px_rgba(99,102,241,0.3)]'
                    : 'border-[rgba(12,8,5,0.08)]'
                }`}
              >
                <button
                  type="button"
                  className="w-full flex items-center justify-between gap-3 px-6 py-5 text-left hover:bg-[rgba(255,252,245,0.70)] transition-colors"
                  onClick={() => setExpandedIdx(isOpen ? null : i)}
                >
                  <div className="flex items-center gap-4">
                    <span
                      className="text-2xl leading-none"
                      style={{
                        filter: isCurrent
                          ? 'drop-shadow(0 0 8px rgba(99,102,241,0.5))'
                          : 'none',
                      }}
                      aria-hidden
                    >
                      {PLANET_EMOJI[d.planet] ?? '✦'}
                    </span>
                    <div>
                      <div className="flex items-center gap-2.5">
                        <span className="text-surface-950 font-semibold">
                          {d.planet} {fp.mahadasha}
                        </span>
                        {isCurrent && (
                          <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-primary-500/15 text-primary-300 border border-primary-500/25 uppercase tracking-widest font-medium">
                            {fp.current}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-[rgba(12,8,5,0.46)] mt-1">
                        {fmtDate(d.startDate)} &rarr; {fmtDate(d.endDate)}
                      </div>
                    </div>
                  </div>
                  {d.subPeriods && d.subPeriods.length > 0 && (
                    <span className="text-[rgba(12,8,5,0.40)] text-xs shrink-0" aria-hidden>
                      {isOpen ? '▲' : '▼'}
                    </span>
                  )}
                </button>
                {isOpen && d.subPeriods && d.subPeriods.length > 0 && (
                  <div className="border-t border-[rgba(12,8,5,0.06)] bg-[rgba(255,252,245,0.70)] px-6 py-4 space-y-2">
                    <p className="text-[11px] uppercase tracking-widest text-[rgba(12,8,5,0.40)] mb-3 font-medium">
                      {fp.antardasha}
                    </p>
                    {d.subPeriods.map((sp, j) => (
                      <div
                        key={j}
                        className="flex items-center justify-between gap-2 text-sm py-1"
                      >
                        <span className="text-secondary flex items-center gap-2">
                          <span aria-hidden>{PLANET_EMOJI[sp.planet] ?? '·'}</span>
                          {sp.planet}
                        </span>
                        <span className="text-[rgba(12,8,5,0.40)]">
                          {fmtDate(sp.startDate)} &rarr; {fmtDate(sp.endDate)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
