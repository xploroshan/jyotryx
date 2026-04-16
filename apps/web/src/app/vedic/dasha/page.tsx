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
    <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-8 pt-4">
      <nav className="mb-4 text-xs text-white/50">
        <Link href={`/${cfg.slug}`} className="hover:text-white">
          {traditionName}
        </Link>{' '}
        / <span className="text-white/70">{featureName}</span>
      </nav>

      <section
        className={`rounded-3xl bg-gradient-to-br ${cfg.heroClass} ring-1 px-6 sm:px-10 py-8 mb-6`}
      >
        <div className="flex items-center gap-4">
          <span className="text-4xl leading-none" aria-hidden>
            🌀
          </span>
          <div>
            <h1 className="text-xl sm:text-2xl font-semibold text-white tracking-tight">
              {featureName}
            </h1>
            <p className="mt-1 text-sm text-white/70">
              {t.kundli.dashaPeriods} — Vimshottari · 120-year cycle
            </p>
          </div>
        </div>
      </section>

      {!isAuthenticated && (
        <div className="glass rounded-2xl p-8 text-center">
          <p className="text-white/70 mb-4">{t.kundli.loginRequired}</p>
          <Link
            href="/auth?mode=login"
            className="inline-block px-5 py-2 btn-primary rounded-lg text-sm"
          >
            {t.common.login}
          </Link>
        </div>
      )}

      {isAuthenticated && !hasBirth && (
        <div className="glass rounded-2xl p-8 text-center">
          <p className="text-white/70 mb-4">{t.kundli.doshaComplete}</p>
          <Link
            href="/profile"
            className="inline-block px-5 py-2 btn-primary rounded-lg text-sm"
          >
            Profile
          </Link>
        </div>
      )}

      {isAuthenticated && hasBirth && loading && (
        <div className="glass rounded-2xl p-8 text-center text-white/60 text-sm">
          {t.common.loading}
        </div>
      )}

      {error && (
        <div className="glass rounded-2xl p-6 text-center text-red-300 text-sm border-red-500/30">
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
                className={`glass rounded-2xl overflow-hidden transition-all ${
                  isCurrent ? 'ring-2 ring-primary-400/50 shadow-[0_8px_24px_-10px] shadow-primary-500/30' : ''
                }`}
              >
                <button
                  type="button"
                  className="w-full flex items-center justify-between gap-3 px-5 py-4 text-left hover:bg-white/[0.03]"
                  onClick={() => setExpandedIdx(isOpen ? null : i)}
                >
                  <div className="flex items-center gap-4">
                    <span
                      className="text-2xl leading-none"
                      style={{
                        filter: isCurrent
                          ? 'drop-shadow(0 0 8px rgba(250,204,21,0.55))'
                          : 'drop-shadow(0 1px 3px rgba(255,255,255,0.2))',
                      }}
                      aria-hidden
                    >
                      {PLANET_EMOJI[d.planet] ?? '✦'}
                    </span>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-white font-semibold">
                          {d.planet} Mahadasha
                        </span>
                        {isCurrent && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary-500/20 text-primary-300 border border-primary-500/30 uppercase tracking-wide">
                            Current
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-white/55 mt-0.5">
                        {fmtDate(d.startDate)} → {fmtDate(d.endDate)}
                      </div>
                    </div>
                  </div>
                  {d.subPeriods && d.subPeriods.length > 0 && (
                    <span className="text-white/40 text-xs shrink-0" aria-hidden>
                      {isOpen ? '▲' : '▼'}
                    </span>
                  )}
                </button>
                {isOpen && d.subPeriods && d.subPeriods.length > 0 && (
                  <div className="border-t border-white/[0.06] bg-black/20 px-5 py-3 space-y-1.5">
                    <p className="text-[10px] uppercase tracking-wide text-white/40 mb-2">
                      Antardasha (sub-periods)
                    </p>
                    {d.subPeriods.map((sp, j) => (
                      <div
                        key={j}
                        className="flex items-center justify-between gap-2 text-xs py-1"
                      >
                        <span className="text-white/75 flex items-center gap-2">
                          <span aria-hidden>{PLANET_EMOJI[sp.planet] ?? '·'}</span>
                          {sp.planet}
                        </span>
                        <span className="text-white/45">
                          {fmtDate(sp.startDate)} → {fmtDate(sp.endDate)}
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
