'use client';

import { useState } from 'react';
import { useAuthStore } from '@/lib/store';
import { api } from '@/lib/api';
import TraditionFeatureStub from '@/components/tradition/TraditionFeatureStub';

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
  const { user, accessToken, isAuthenticated } = useAuthStore();
  const [dateOfBirth, setDateOfBirth] = useState(user?.dateOfBirth?.slice(0, 10) ?? '');
  const [timeOfBirth, setTimeOfBirth] = useState(user?.timeOfBirth ?? '');
  const [placeOfBirth, setPlaceOfBirth] = useState(user?.placeOfBirth ?? '');
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
        { dateOfBirth, timeOfBirth, placeOfBirth },
        { token: accessToken ?? undefined },
      );
      setResult(res);
    } catch (err: any) {
      setError(err?.message ?? 'Request failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <TraditionFeatureStub
      traditionId="WESTERN"
      featureKey="traditionsUi.western.features.natal"
    >
      {!isAuthenticated ? (
        <p className="text-sm text-white/60 text-center py-6">
          Log in to get your personalised natal chart.
        </p>
      ) : (
        <>
          <form onSubmit={handleSubmit} className="space-y-4">
            <input
              type="date"
              value={dateOfBirth}
              onChange={(e) => setDateOfBirth(e.target.value)}
              required
              className="w-full bg-white/[0.04] border divider rounded-lg px-3 py-2 text-sm text-white"
            />
            <input
              type="time"
              value={timeOfBirth}
              onChange={(e) => setTimeOfBirth(e.target.value)}
              required
              className="w-full bg-white/[0.04] border divider rounded-lg px-3 py-2 text-sm text-white"
            />
            <input
              type="text"
              value={placeOfBirth}
              onChange={(e) => setPlaceOfBirth(e.target.value)}
              placeholder="City, Country"
              required
              className="w-full bg-white/[0.04] border divider rounded-lg px-3 py-2 text-sm text-white"
            />
            <button
              type="submit"
              disabled={loading}
              className="btn-primary rounded-lg px-4 py-2 text-sm disabled:opacity-50"
            >
              {loading ? 'Processing...' : 'Calculate Natal Chart'}
            </button>
            {error && <p className="text-xs text-red-400">{error}</p>}
          </form>

          {result && (
            <div className="mt-6 space-y-4">
              <div className="rounded-xl border divider bg-white/[0.03] p-4">
                <div className="text-xs uppercase tracking-wider text-white/40">
                  Ascendant
                </div>
                <div className="mt-1 text-white font-medium">
                  {result.ascendant.sign} ({result.ascendant.degree.toFixed(2)}°)
                </div>
              </div>
              <div className="rounded-xl border divider bg-white/[0.03] p-4">
                <div className="text-xs uppercase tracking-wider text-white/40 mb-3">
                  Planets
                </div>
                <ul className="space-y-2 text-sm text-white/80">
                  {result.planets.map((p) => (
                    <li key={p.planet} className="flex justify-between">
                      <span>{p.planet}</span>
                      <span className="text-white/60">
                        {p.sign} {p.degree.toFixed(2)}°
                        {p.house !== null ? ` · H${p.house}` : ''}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
              {result.interpretation && (
                <div className="rounded-xl border divider bg-white/[0.03] p-4">
                  <p className="text-sm text-white/80 whitespace-pre-wrap">
                    {result.interpretation}
                  </p>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </TraditionFeatureStub>
  );
}
