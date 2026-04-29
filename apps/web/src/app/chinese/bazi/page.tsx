'use client';

import { useState } from 'react';
import { useTranslation } from '@/i18n';
import { useAuthStore } from '@/lib/store';
import { api } from '@/lib/api';
import TraditionFeatureStub from '@/components/tradition/TraditionFeatureStub';

interface BaZiResponse {
  pillars: {
    year: { heavenlyStem: string; earthlyBranch: string; animal: string; element: string };
    month: { heavenlyStem: string; earthlyBranch: string; animal: string; element: string };
    day: { heavenlyStem: string; earthlyBranch: string; animal: string; element: string };
    hour: { heavenlyStem: string; earthlyBranch: string; animal: string; element: string };
  };
  dayMaster: string;
  elementBalance: Record<string, number>;
  interpretation: string;
}

/**
 * Chinese BaZi (Four Pillars) — user submits birth details, backend
 * returns the four pillars plus an LLM-authored interpretation.
 */
export default function ChineseBaZiPage() {
  const { t, locale } = useTranslation();
  const fp = t.featurePages.chineseBazi;
  const { user, isAuthenticated, accessToken } = useAuthStore();
  const [dateOfBirth, setDateOfBirth] = useState(user?.dateOfBirth?.slice(0, 10) ?? '');
  const [timeOfBirth, setTimeOfBirth] = useState(user?.timeOfBirth ?? '');
  const [placeOfBirth, setPlaceOfBirth] = useState(user?.placeOfBirth ?? '');
  const [result, setResult] = useState<BaZiResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const res = await api.post<BaZiResponse>(
        '/astrology/bazi',
        { dateOfBirth, timeOfBirth, placeOfBirth, locale },
        { token: accessToken ?? undefined },
      );
      setResult(res);
    } catch (err: any) {
      setError(err?.message ?? t.featurePages.requestFailed);
    } finally {
      setLoading(false);
    }
  };

  const pillarLabel: Record<'year' | 'month' | 'day' | 'hour', string> = {
    year: fp.pillarYear,
    month: fp.pillarMonth,
    day: fp.pillarDay,
    hour: fp.pillarHour,
  };

  return (
    <TraditionFeatureStub
      traditionId="CHINESE"
      featureKey="traditionsUi.chinese.features.bazi"
      descriptionKey="featurePages.chineseBazi.description"
    >
      {!isAuthenticated ? (
        <p className="text-sm text-surface-900/60 text-center py-6">
          {fp.loginPrompt}
        </p>
      ) : (
        <>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs text-surface-900/60 mb-1">{t.form.dateOfBirth}</label>
              <input
                type="date"
                value={dateOfBirth}
                onChange={(e) => setDateOfBirth(e.target.value)}
                required
                className="w-full bg-surface-900/[0.04] border divider rounded-lg px-3 py-2 text-sm text-surface-900"
              />
            </div>
            <div>
              <label className="block text-xs text-surface-900/60 mb-1">{t.form.timeOfBirth}</label>
              <input
                type="time"
                value={timeOfBirth}
                onChange={(e) => setTimeOfBirth(e.target.value)}
                required
                className="w-full bg-surface-900/[0.04] border divider rounded-lg px-3 py-2 text-sm text-surface-900"
              />
            </div>
            <div>
              <label className="block text-xs text-surface-900/60 mb-1">{t.form.placeOfBirth}</label>
              <input
                type="text"
                value={placeOfBirth}
                onChange={(e) => setPlaceOfBirth(e.target.value)}
                placeholder={t.form.placePlaceholder}
                required
                className="w-full bg-surface-900/[0.04] border divider rounded-lg px-3 py-2 text-sm text-surface-900"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="btn-primary rounded-lg px-4 py-2 text-sm disabled:opacity-50"
            >
              {loading ? t.common.processing : fp.submit}
            </button>
            {error && (
              <p className="text-xs text-red-400 mt-2">{error}</p>
            )}
          </form>

          {result && (
            <div className="mt-6 space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {(['year', 'month', 'day', 'hour'] as const).map((k) => {
                  const p = result.pillars[k];
                  return (
                    <div key={k} className="rounded-xl border divider bg-surface-900/[0.03] p-3">
                      <div className="text-[10px] uppercase tracking-wider text-surface-900/40">
                        {pillarLabel[k]} {fp.pillarSuffix}
                      </div>
                      <div className="mt-1 text-surface-900 text-sm font-semibold">
                        {p.heavenlyStem} · {p.earthlyBranch}
                      </div>
                      <div className="text-xs text-surface-900/60">
                        {p.animal} · {p.element}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="rounded-xl border divider bg-surface-900/[0.03] p-4">
                <div className="text-xs uppercase tracking-wider text-surface-900/40">
                  {fp.dayMaster}
                </div>
                <div className="mt-1 text-surface-900 font-medium">{result.dayMaster}</div>
              </div>
              {result.interpretation && (
                <div className="rounded-xl border divider bg-surface-900/[0.03] p-4">
                  <p className="text-sm text-surface-900/80 whitespace-pre-wrap leading-relaxed">
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
