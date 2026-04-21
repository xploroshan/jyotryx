'use client';

import { useEffect, useState } from 'react';
import { useTranslation } from '@/i18n';
import { api } from '@/lib/api';
import FeaturePageShell from '@/components/tradition/FeaturePageShell';

interface FlyingStarsResponse {
  year: number;
  centerStar: number;
  centerMeaning: string;
  grid: number[][];
  meanings: Record<string, string>;
  interpretation: string;
}

const STAR_BG: Record<number, string> = {
  1: 'from-sky-500/25 to-sky-500/5 border-sky-500/30',
  2: 'from-amber-900/25 to-amber-900/5 border-amber-900/30',
  3: 'from-emerald-700/25 to-emerald-700/5 border-emerald-700/30',
  4: 'from-emerald-500/25 to-emerald-500/5 border-emerald-500/30',
  5: 'from-stone-500/25 to-stone-500/5 border-stone-500/30',
  6: 'from-slate-300/25 to-slate-300/5 border-slate-300/30',
  7: 'from-rose-500/25 to-rose-500/5 border-rose-500/30',
  8: 'from-yellow-500/25 to-yellow-500/5 border-yellow-500/30',
  9: 'from-red-500/25 to-red-500/5 border-red-500/30',
};

const PALACE_LABELS = [
  ['SE', 'S', 'SW'],
  ['E', 'Center', 'W'],
  ['NE', 'N', 'NW'],
];

/**
 * Feng Shui Flying Stars — 9-palace Lo Shu grid for the selected year.
 * Lets the user scrub through years to see how the annual stars shift.
 */
export default function ChineseFlyingStarsPage() {
  const { t, locale } = useTranslation();
  const currentYear = new Date().getUTCFullYear();
  const [year, setYear] = useState(currentYear);
  const [result, setResult] = useState<FlyingStarsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    api
      .get<FlyingStarsResponse>(`/astrology/chinese/flying-stars?year=${year}&locale=${locale}`)
      .then((res) => {
        if (!cancelled) setResult(res);
      })
      .catch((err: any) => {
        if (!cancelled) setError(err?.message ?? t.kundli.generateFailed);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [year, locale, t.kundli.generateFailed]);

  return (
    <FeaturePageShell
      traditionId="CHINESE"
      featureKey="traditionsUi.chinese.features.flyingStars"
      icon="⭐"
      description="Annual Lo Shu 9-palace star arrangement"
    >
      <div className="glass rounded-2xl p-4 mb-4 flex items-center justify-between gap-3">
        <label className="text-xs text-white/60">Year</label>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setYear((y) => y - 1)}
            className="px-2 py-1 rounded bg-white/5 text-white/70 text-sm hover:bg-white/10"
          >
            −
          </button>
          <input
            type="number"
            min={1900}
            max={2100}
            value={year}
            onChange={(e) => setYear(parseInt(e.target.value, 10) || currentYear)}
            className="surface-input rounded-lg px-2 py-1 w-20 text-center text-sm"
          />
          <button
            type="button"
            onClick={() => setYear((y) => y + 1)}
            className="px-2 py-1 rounded bg-white/5 text-white/70 text-sm hover:bg-white/10"
          >
            +
          </button>
        </div>
      </div>

      {loading && (
        <div className="glass rounded-2xl p-8 text-center text-sm text-white/60">
          {t.common.loading}
        </div>
      )}
      {error && (
        <div className="glass rounded-2xl p-6 text-sm text-red-300 text-center">
          {error}
        </div>
      )}

      {result && !loading && (
        <div className="space-y-4">
          <div className="glass rounded-2xl p-5">
            <div className="grid grid-cols-3 gap-2">
              {result.grid.map((row, r) =>
                row.map((star, c) => (
                  <div
                    key={`${r}-${c}`}
                    className={`aspect-square rounded-2xl border bg-gradient-to-br ${
                      STAR_BG[star] ?? 'from-white/10 to-white/[0.02] border-white/10'
                    } p-3 flex flex-col items-center justify-center relative overflow-hidden`}
                  >
                    <div className="text-[9px] uppercase tracking-wide text-white/40">
                      {PALACE_LABELS[r][c]}
                    </div>
                    <div className="text-4xl font-bold text-white leading-none mt-1">
                      {star}
                    </div>
                  </div>
                )),
              )}
            </div>
          </div>

          <div className="glass-strong rounded-2xl p-5">
            <p className="text-[10px] uppercase tracking-wide text-white/50">
              Center Star {result.centerStar}
            </p>
            <p className="text-sm text-white mt-2">{result.centerMeaning}</p>
            <p className="text-xs text-white/70 mt-3">{result.interpretation}</p>
          </div>

          <div className="glass rounded-2xl p-5">
            <p className="text-[10px] uppercase tracking-wide text-white/50 mb-3">
              Star meanings
            </p>
            <ul className="space-y-1.5 text-xs">
              {Object.entries(result.meanings).map(([num, meaning]) => (
                <li key={num} className="flex gap-3">
                  <span className="shrink-0 w-5 h-5 rounded-full bg-white/10 text-white text-[11px] font-semibold grid place-items-center">
                    {num}
                  </span>
                  <span className="text-white/70">{meaning}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </FeaturePageShell>
  );
}
