'use client';

import { useEffect, useState } from 'react';
import { useAuthStore } from '@/lib/store';
import { useTranslation } from '@/i18n';
import { api } from '@/lib/api';
import FeaturePageShell from '@/components/tradition/FeaturePageShell';

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
  Conjunction: 'bg-primary-500/15 text-primary-300',
  Sextile: 'bg-emerald-500/15 text-emerald-300',
  Square: 'bg-amber-500/15 text-amber-300',
  Trine: 'bg-sky-500/15 text-sky-300',
  Opposition: 'bg-red-500/15 text-red-300',
};

const PLANET_GLYPH: Record<string, string> = {
  Sun: '☉', Moon: '☽', Mercury: '☿', Venus: '♀',
  Mars: '♂', Jupiter: '♃', Saturn: '♄',
};

/**
 * Western transits — today's planetary positions plus exact aspects
 * to the user's natal chart. Auto-fetches using the saved profile DOB
 * once the user is signed in.
 */
export default function WesternTransitsPage() {
  const { t } = useTranslation();
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
        { dateOfBirth: user!.dateOfBirth, timeOfBirth: user!.timeOfBirth },
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
  }, [isAuthenticated, hasBirth, user, accessToken, t.kundli.generateFailed]);

  return (
    <FeaturePageShell
      traditionId="WESTERN"
      featureKey="traditionsUi.western.features.transits"
      icon="🌠"
      description="Today's transits · cross-aspects to your natal planets"
    >
      {!isAuthenticated && (
        <div className="glass rounded-2xl p-8 text-center text-sm text-white/70">
          {t.kundli.loginRequired}
        </div>
      )}
      {isAuthenticated && !hasBirth && (
        <div className="glass rounded-2xl p-8 text-center text-sm text-white/70">
          {t.kundli.doshaComplete}
        </div>
      )}
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
      {result && (
        <div className="space-y-4">
          <div className="glass rounded-2xl p-5">
            <p className="text-[10px] uppercase tracking-wide text-white/50 mb-3">
              Transits for {result.date}
            </p>
            <ul className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {result.transitingPlanets.map((p) => (
                <li
                  key={p.planet}
                  className="rounded-xl bg-white/[0.04] border border-white/[0.06] px-3 py-2"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-lg" aria-hidden>
                      {PLANET_GLYPH[p.planet] ?? '✦'}
                    </span>
                    <span className="text-white font-medium text-sm">{p.planet}</span>
                  </div>
                  <div className="text-xs text-white/60 mt-1">
                    {p.sign} {p.degree.toFixed(1)}°
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div className="glass rounded-2xl p-5">
            <p className="text-[10px] uppercase tracking-wide text-white/50 mb-3">
              Active aspects ({result.aspects.length})
            </p>
            {result.aspects.length === 0 ? (
              <p className="text-sm text-white/50 text-center py-4">
                No major aspects today — a quieter transit window.
              </p>
            ) : (
              <ul className="divide-y divide-white/[0.06]">
                {result.aspects.map((a, i) => (
                  <li
                    key={i}
                    className="flex items-center justify-between gap-2 py-2 text-sm"
                  >
                    <span className="text-white/90">
                      Transiting {a.transiting}
                      <span className="text-white/40 mx-2">→</span>
                      Natal {a.natal}
                    </span>
                    <span
                      className={`shrink-0 text-[11px] px-2 py-0.5 rounded-full ${
                        ASPECT_CLASS[a.aspect] ?? 'bg-white/10 text-white/70'
                      }`}
                    >
                      {a.aspect} · {a.orb}°
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="glass rounded-2xl p-5 text-sm text-white/80 leading-relaxed">
            {result.interpretation}
          </div>
        </div>
      )}
    </FeaturePageShell>
  );
}
