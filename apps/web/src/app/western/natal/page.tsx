'use client';

import { useState } from 'react';
import { useTranslation } from '@/i18n';
import { useAuthStore } from '@/lib/store';
import { api } from '@/lib/api';
import TraditionFeatureStub from '@/components/tradition/TraditionFeatureStub';
import SavedBirthDetails, { type BirthDetailsValue } from '@/components/ui/SavedBirthDetails';
import Interpretation from '@/components/interpretation/Interpretation';

interface NatalPlanet {
  planet: string;
  sign: string;
  degree: number;
  house: number | null;
}

interface NatalResponse {
  ascendant: { sign: string; degree: number };
  planets: NatalPlanet[];
  interpretation?: string;
}

export default function WesternNatalPage() {
  const { t, locale } = useTranslation();
  const fp = t.featurePages.westernNatal;
  const { accessToken, isAuthenticated } = useAuthStore();
  const [birth, setBirth] = useState<BirthDetailsValue>({ dateOfBirth: '', timeOfBirth: '', placeOfBirth: '' });
  const [result, setResult] = useState<NatalResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await api.post<NatalResponse>(
        '/astrology/western/natal',
        { ...birth, locale },
        { token: accessToken ?? undefined },
      );
      setResult(res);
    } catch (err: any) {
      setError(err?.message ?? t.featurePages.requestFailed);
    } finally {
      setLoading(false);
    }
  };

  return (
    <TraditionFeatureStub
      traditionId="WESTERN"
      featureKey="traditionsUi.western.features.natal"
      descriptionKey="featurePages.westernNatal.description"
    >
      {!isAuthenticated ? (
        <p className="text-sm text-secondary text-center py-6">
          {fp.loginPrompt}
        </p>
      ) : (
        <>
          <form onSubmit={handleSubmit} className="space-y-4">
            <SavedBirthDetails value={birth} onChange={setBirth} idPrefix="western-natal" />
            <button
              type="submit"
              disabled={loading || !birth.dateOfBirth || !birth.timeOfBirth || !birth.placeOfBirth}
              className="btn-primary rounded-lg px-4 py-2 text-sm disabled:opacity-50"
            >
              {loading ? t.common.processing : fp.submit}
            </button>
            {error && <p className="text-xs text-red-400">{error}</p>}
          </form>

          {result && (
            <div className="mt-6 space-y-4">
              <div className="rounded-xl border divider bg-[rgba(255,252,245,0.78)] p-4">
                <div className="text-xs uppercase tracking-wider text-[rgba(12,8,5,0.66)]">
                  {fp.ascendant}
                </div>
                <div className="mt-1 text-surface-950 font-medium">
                  {result.ascendant.sign} ({result.ascendant.degree.toFixed(2)}°)
                </div>
              </div>
              <div className="rounded-xl border divider bg-[rgba(255,252,245,0.78)] p-4">
                <div className="text-xs uppercase tracking-wider text-[rgba(12,8,5,0.66)] mb-3">
                  {fp.planets}
                </div>
                <ul className="space-y-2 text-sm text-emphasis">
                  {result.planets.map((p) => (
                    <li key={p.planet} className="flex justify-between">
                      <span>{p.planet}</span>
                      <span className="text-secondary">
                        {p.sign} {p.degree.toFixed(2)}°
                        {p.house !== null ? ` · H${p.house}` : ''}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
              {result.interpretation && (
                <div className="rounded-xl border divider bg-[rgba(255,252,245,0.78)] p-4">
                  <p className="text-sm text-emphasis whitespace-pre-wrap">
                    {result.interpretation}
                  </p>
                </div>
              )}

              <Interpretation
                domain="western-natal"
                input={{
                  ascendant: result.ascendant,
                  planets: result.planets.map((p) => ({ planet: p.planet, sign: p.sign, house: p.house })),
                }}
              />
            </div>
          )}
        </>
      )}
    </TraditionFeatureStub>
  );
}
