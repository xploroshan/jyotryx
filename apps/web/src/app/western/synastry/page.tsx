'use client';

import { useState } from 'react';
import { useAuthStore } from '@/lib/store';
import { useTranslation } from '@/i18n';
import { api } from '@/lib/api';
import FeaturePageShell from '@/components/tradition/FeaturePageShell';

interface Partner {
  ascendant: { sign: string; degree: number };
  sun: { sign: string; element: string; modality: string };
  moon: { sign: string };
}

interface SynastryResponse {
  partner1: Partner;
  partner2: Partner;
  aspects: { a: string; b: string; aspect: string; orb: number; quality: string }[];
  compatibility: {
    score: number;
    harmonious: number;
    challenging: number;
    summary: string;
  };
}

interface PersonForm {
  dob: string;
  tob: string;
}

/**
 * Western Synastry — compare two natal charts and show compatibility
 * through cross-chart aspects between luminaries, Venus and Mars.
 */
export default function WesternSynastryPage() {
  const { t, locale } = useTranslation();
  const fp = t.featurePages.westernSynastry;
  const { user, accessToken, isAuthenticated } = useAuthStore();
  const [p1, setP1] = useState<PersonForm>({
    dob: user?.dateOfBirth?.slice(0, 10) ?? '',
    tob: user?.timeOfBirth ?? '',
  });
  const [p2, setP2] = useState<PersonForm>({ dob: '', tob: '' });
  const [result, setResult] = useState<SynastryResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const canSubmit = p1.dob && p1.tob && p2.dob && p2.tob && !loading;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setLoading(true);
    setError('');
    try {
      const res = await api.post<SynastryResponse>(
        '/astrology/western/synastry',
        {
          partner1: { dateOfBirth: p1.dob, timeOfBirth: p1.tob },
          partner2: { dateOfBirth: p2.dob, timeOfBirth: p2.tob },
          locale,
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
      traditionId="WESTERN"
      featureKey="traditionsUi.western.features.synastry"
      icon="💞"
      descriptionKey="featurePages.westernSynastry.description"
    >
      {!isAuthenticated ? (
        <div className="glass rounded-2xl p-8 text-center text-sm text-surface-50/70">
          {t.kundli.loginRequired}
        </div>
      ) : (
        <div className="glass rounded-2xl p-5 sm:p-6 mb-4">
          <form onSubmit={submit} className="space-y-4">
            <div>
              <p className="text-[11px] uppercase tracking-wide text-surface-50/50 mb-2">
                {fp.partner1}
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <input
                  type="date"
                  value={p1.dob}
                  onChange={(e) => setP1({ ...p1, dob: e.target.value })}
                  required
                  className="surface-input rounded-lg px-3 py-2 text-sm"
                />
                <input
                  type="time"
                  value={p1.tob}
                  onChange={(e) => setP1({ ...p1, tob: e.target.value })}
                  required
                  className="surface-input rounded-lg px-3 py-2 text-sm"
                />
              </div>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-wide text-surface-50/50 mb-2">
                {fp.partner2}
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <input
                  type="date"
                  value={p2.dob}
                  onChange={(e) => setP2({ ...p2, dob: e.target.value })}
                  required
                  className="surface-input rounded-lg px-3 py-2 text-sm"
                />
                <input
                  type="time"
                  value={p2.tob}
                  onChange={(e) => setP2({ ...p2, tob: e.target.value })}
                  required
                  className="surface-input rounded-lg px-3 py-2 text-sm"
                />
              </div>
            </div>
            <div className="flex items-center justify-between gap-3">
              <button
                type="submit"
                disabled={!canSubmit}
                className="btn-primary rounded-lg px-5 py-2 text-sm disabled:opacity-50"
              >
                {loading ? t.common.loading : fp.analyze}
              </button>
              {error && <p className="text-xs text-red-400">{error}</p>}
            </div>
          </form>
        </div>
      )}

      {result && (
        <div className="space-y-4">
          <div className="glass-strong rounded-2xl p-6 text-center">
            <p className="text-[10px] uppercase tracking-wide text-surface-50/50">
              {fp.compatibility}
            </p>
            <p className="text-5xl font-bold text-surface-50 mt-2">
              {result.compatibility.score}
              <span className="text-2xl text-surface-50/50">%</span>
            </p>
            <p className="text-sm text-surface-50/70 mt-3">{result.compatibility.summary}</p>
            <div className="flex items-center justify-center gap-6 mt-4 text-xs">
              <span className="text-emerald-300">
                ✓ {result.compatibility.harmonious} {fp.harmonious}
              </span>
              <span className="text-amber-300">
                ⚡ {result.compatibility.challenging} {fp.challenging}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {([result.partner1, result.partner2] as const).map((p, i) => (
              <div key={i} className="glass rounded-2xl p-4">
                <p className="text-[10px] uppercase tracking-wide text-surface-50/50 mb-2">
                  {fp.partnerPrefix} {i + 1}
                </p>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-surface-50/60">{fp.sun}</span>
                    <span className="text-surface-50">
                      {p.sun.sign} ({p.sun.element})
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-surface-50/60">{fp.moon}</span>
                    <span className="text-surface-50">{p.moon.sign}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-surface-50/60">{fp.asc}</span>
                    <span className="text-surface-50">{p.ascendant.sign}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {result.aspects.length > 0 && (
            <div className="glass rounded-2xl p-5">
              <p className="text-[10px] uppercase tracking-wide text-surface-50/50 mb-3">
                {fp.crossAspects}
              </p>
              <ul className="divide-y divide-white/[0.06]">
                {result.aspects.map((a, i) => (
                  <li
                    key={i}
                    className="flex items-center justify-between gap-2 py-2 text-sm"
                  >
                    <div>
                      <span className="text-surface-50/90">{a.a}</span>
                      <span className="text-surface-50/40 mx-2">·</span>
                      <span className="text-surface-50/90">{a.b}</span>
                    </div>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full ${
                        a.quality === 'harmonious'
                          ? 'bg-emerald-500/15 text-emerald-300'
                          : 'bg-amber-500/15 text-amber-300'
                      }`}
                    >
                      {a.aspect} · {a.orb}°
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </FeaturePageShell>
  );
}
