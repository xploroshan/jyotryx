'use client';

import { useState } from 'react';
import { useAuthStore } from '@/lib/store';
import { useTranslation } from '@/i18n';
import { api } from '@/lib/api';
import FeaturePageShell from '@/components/tradition/FeaturePageShell';
import { PlanetGlyph } from '@/components/icons/astro';
import SavedBirthDetails, { type BirthDetailsValue } from '@/components/ui/SavedBirthDetails';

interface HouseRow {
  house: number;
  sign: string;
  planets: string[];
}
interface PlanetRow {
  planet: string;
  sign: string;
  house: number;
  degree: number;
  isRetrograde: boolean;
  nakshatra?: string;
}
interface KundliResponse {
  id: string;
  ascendant: string;
  moonSign: string;
  sunSign: string;
  houses: HouseRow[];
  planetaryPositions: PlanetRow[];
  interpretation?: string;
}


/**
 * Hellenistic natal chart — reuses the shared `/astrology/kundli`
 * engine with `tradition: 'HELLENISTIC'` so the underlying whole-sign
 * houses and planetary positions are computed once across traditions.
 * Renders the hero + a form for birth details, then the ascendant,
 * luminaries, house-sign table, and planet placements.
 */
export default function HellenisticNatalPage() {
  const { t, locale } = useTranslation();
  const fp = t.featurePages.hellenisticNatal;
  const { accessToken, isAuthenticated } = useAuthStore();
  const [birth, setBirth] = useState<BirthDetailsValue>({ dateOfBirth: '', timeOfBirth: '', placeOfBirth: '' });
  const [result, setResult] = useState<KundliResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const canSubmit = birth.dateOfBirth && birth.timeOfBirth && birth.placeOfBirth && !loading;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setLoading(true);
    setError('');
    try {
      const res = await api.post<KundliResponse>(
        '/astrology/kundli',
        {
          dateOfBirth: birth.dateOfBirth,
          timeOfBirth: birth.timeOfBirth,
          placeOfBirth: birth.placeOfBirth,
          locale,
          tradition: 'HELLENISTIC',
        },
        { token: accessToken ?? undefined },
      );
      setResult(res);
    } catch (err: any) {
      setError(err?.message ?? t.kundli.generateFailed);
    } finally {
      setLoading(false);
    }
  };

  return (
    <FeaturePageShell
      traditionId="HELLENISTIC"
      featureKey="traditionsUi.hellenistic.features.natal"
      descriptionKey="featurePages.hellenisticNatal.description"
    >
      {!isAuthenticated ? (
        <div className="glass rounded-2xl p-8 text-center text-sm text-emphasis">
          {t.kundli.loginRequired}
        </div>
      ) : (
        <div className="glass rounded-2xl p-5 sm:p-6 mb-4">
          <form onSubmit={submit} className="space-y-3">
            <SavedBirthDetails value={birth} onChange={setBirth} idPrefix="hellenistic-natal" />
            <div className="flex items-center justify-between gap-3">
              <button
                type="submit"
                disabled={!canSubmit}
                className="btn-primary rounded-lg px-5 py-2 text-sm disabled:opacity-50"
              >
                {loading ? t.common.loading : fp.submit}
              </button>
              {error && <p className="text-xs text-red-400">{error}</p>}
            </div>
          </form>
        </div>
      )}

      {result && (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div className="glass rounded-2xl p-4">
              <p className="text-[10px] uppercase tracking-wide text-[rgba(12,8,5,0.66)]">
                {fp.ascendant}
              </p>
              <p className="text-lg font-semibold text-surface-950 mt-1">{result.ascendant}</p>
            </div>
            <div className="glass rounded-2xl p-4">
              <p className="text-[10px] uppercase tracking-wide text-[rgba(12,8,5,0.66)]">{fp.sun}</p>
              <p className="text-lg font-semibold text-surface-950 mt-1">{result.sunSign}</p>
            </div>
            <div className="glass rounded-2xl p-4">
              <p className="text-[10px] uppercase tracking-wide text-[rgba(12,8,5,0.66)]">{fp.moon}</p>
              <p className="text-lg font-semibold text-surface-950 mt-1">{result.moonSign}</p>
            </div>
          </div>

          <div className="glass rounded-2xl p-5">
            <p className="text-[10px] uppercase tracking-wide text-[rgba(12,8,5,0.66)] mb-3">
              {fp.planets}
            </p>
            <ul className="divide-y divide-white/[0.06]">
              {result.planetaryPositions.map((p) => (
                <li
                  key={p.planet}
                  className="flex items-center justify-between py-2 text-sm"
                >
                  <span className="flex items-center gap-2 text-emphasis">
                    <PlanetGlyph planet={p.planet} size={18} className="text-primary-700" />
                    {p.planet}
                    {p.isRetrograde && (
                      <span className="text-[10px] px-1.5 rounded bg-amber-100 text-amber-800">
                        R
                      </span>
                    )}
                  </span>
                  <span className="text-secondary text-xs">
                    {p.sign} · {p.degree.toFixed(2)}° · H{p.house}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div className="glass rounded-2xl p-5">
            <p className="text-[10px] uppercase tracking-wide text-[rgba(12,8,5,0.66)] mb-3">
              {fp.houses}
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {result.houses.map((h) => (
                <div
                  key={h.house}
                  className="rounded-xl bg-[rgba(255,252,245,0.78)] border border-[rgba(12,8,5,0.08)] px-3 py-2"
                >
                  <div className="flex items-center justify-between text-xs text-[rgba(12,8,5,0.72)]">
                    <span>{fp.housePrefix} {h.house}</span>
                    <span>{h.sign}</span>
                  </div>
                  {h.planets.length > 0 && (
                    <div className="text-xs text-emphasis mt-1">
                      {h.planets.join(', ')}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {result.interpretation && (
            <div className="glass rounded-2xl p-5 text-sm text-emphasis whitespace-pre-wrap leading-relaxed">
              {result.interpretation}
            </div>
          )}
        </div>
      )}
    </FeaturePageShell>
  );
}
