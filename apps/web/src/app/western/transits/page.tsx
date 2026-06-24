'use client';

import { useEffect, useState } from 'react';
import { useAuthStore } from '@/lib/store';
import { useTranslation } from '@/i18n';
import { api } from '@/lib/api';
import FeaturePageShell from '@/components/tradition/FeaturePageShell';
import { PlanetGlyph } from '@/components/icons/astro';

interface TransitPlanet {
  planet: string;
  sign: string;
  degree: number;
  longitude: number;
}

interface TransitsResponse {
  date: string;
  transitingPlanets: TransitPlanet[];
  aspects: { transiting: string; natal: string; aspect: string; orb: number }[];
  interpretation: string;
}

const ASPECT_CLASS: Record<string, string> = {
  // Light tint bg + dark text so the pill reads on the app's cream surface.
  // The previous bg-*-500/15 + text-*-300 combo was a faint tint under a
  // light shade — washed out and barely legible (see the transits badges).
  Conjunction: 'bg-primary-100 text-primary-800',
  Sextile: 'bg-emerald-100 text-emerald-800',
  Square: 'bg-amber-100 text-amber-800',
  Trine: 'bg-sky-100 text-sky-800',
  Opposition: 'bg-red-100 text-red-800',
};


/**
 * Western transits — today's planetary positions plus exact aspects
 * to the user's natal chart. Auto-fetches using the saved profile DOB
 * once the user is signed in.
 */
export default function WesternTransitsPage() {
  const { t, locale } = useTranslation();
  const fp = t.featurePages.westernTransits;
  const { user, accessToken, isAuthenticated } = useAuthStore();
  const [result, setResult] = useState<TransitsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const hasBirth = Boolean(user?.dateOfBirth && user?.timeOfBirth);

  useEffect(() => {
    if (!isAuthenticated || !hasBirth) return;
    let cancelled = false;
    setLoading(true);
    setError('');
    api
      .post<TransitsResponse>(
        '/astrology/western/transits',
        { dateOfBirth: user!.dateOfBirth, timeOfBirth: user!.timeOfBirth, locale },
        { token: accessToken ?? undefined },
      )
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
  }, [isAuthenticated, hasBirth, user, accessToken, locale, t.kundli.generateFailed]);

  return (
    <FeaturePageShell
      traditionId="WESTERN"
      featureKey="traditionsUi.western.features.transits"
      descriptionKey="featurePages.westernTransits.description"
    >
      {!isAuthenticated && (
        <div className="glass rounded-2xl p-8 text-center text-sm text-emphasis">
          {t.kundli.loginRequired}
        </div>
      )}
      {isAuthenticated && !hasBirth && (
        <div className="glass rounded-2xl p-8 text-center text-sm text-emphasis">
          {t.kundli.doshaComplete}
        </div>
      )}
      {loading && (
        <div className="glass rounded-2xl p-8 text-center text-sm text-secondary">
          {t.common.loading}
        </div>
      )}
      {error && (
        <div className="glass rounded-2xl p-6 text-sm text-red-300 text-center">
          {error}
        </div>
      )}
      {result && (
        <div className="space-y-4">
          <div className="glass rounded-2xl p-5">
            <p className="text-[10px] uppercase tracking-wide text-[rgba(12,8,5,0.72)] mb-3">
              {fp.transitsForPrefix} {result.date}
            </p>
            <ul className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {result.transitingPlanets.map((p) => (
                <li
                  key={p.planet}
                  className="rounded-xl bg-[rgba(255,252,245,0.86)] border border-[rgba(12,8,5,0.08)] px-3 py-2"
                >
                  <div className="flex items-center gap-2">
                    <PlanetGlyph planet={p.planet} size={20} className="text-primary-700" />
                    <span className="text-surface-950 font-medium text-sm">{p.planet}</span>
                  </div>
                  <div className="text-xs text-secondary mt-1">
                    {p.sign} {p.degree.toFixed(1)}°
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div className="glass rounded-2xl p-5">
            <p className="text-[10px] uppercase tracking-wide text-[rgba(12,8,5,0.72)] mb-3">
              {fp.activeAspectsPrefix} ({result.aspects.length})
            </p>
            {result.aspects.length === 0 ? (
              <p className="text-sm text-[rgba(12,8,5,0.72)] text-center py-4">
                {fp.noAspects}
              </p>
            ) : (
              <ul className="divide-y divide-white/[0.06]">
                {result.aspects.map((a, i) => (
                  <li
                    key={i}
                    className="flex items-center justify-between gap-2 py-2 text-sm"
                  >
                    <span className="text-emphasis">
                      {fp.transiting} {a.transiting}
                      <span className="text-[rgba(12,8,5,0.66)] mx-2">→</span>
                      {fp.natal} {a.natal}
                    </span>
                    <span
                      className={`shrink-0 text-[11px] px-2 py-0.5 rounded-full ${
                        ASPECT_CLASS[a.aspect] ?? 'bg-[rgba(12,8,5,0.07)] text-emphasis'
                      }`}
                    >
                      {a.aspect} · {a.orb}°
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="glass rounded-2xl p-5 text-sm text-emphasis leading-relaxed">
            {result.interpretation}
          </div>
        </div>
      )}
    </FeaturePageShell>
  );
}
