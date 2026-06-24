'use client';

import { useState } from 'react';
import { useTranslation } from '@/i18n';
import { useAuthStore } from '@/lib/store';
import { api } from '@/lib/api';
import TraditionFeatureStub from '@/components/tradition/TraditionFeatureStub';
import SavedBirthDetails, { type BirthDetailsValue } from '@/components/ui/SavedBirthDetails';

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
  const { isAuthenticated, accessToken } = useAuthStore();
  const [birth, setBirth] = useState<BirthDetailsValue>({ dateOfBirth: '', timeOfBirth: '', placeOfBirth: '' });
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
        <p className="text-sm text-secondary text-center py-6">
          {fp.loginPrompt}
        </p>
      ) : (
        <>
          <form onSubmit={handleSubmit} className="space-y-4">
            <SavedBirthDetails value={birth} onChange={setBirth} idPrefix="bazi" />
            <button
              type="submit"
              disabled={loading || !birth.dateOfBirth || !birth.timeOfBirth || !birth.placeOfBirth}
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
                    <div key={k} className="rounded-xl border divider bg-[rgba(255,252,245,0.78)] p-3">
                      <div className="text-[10px] uppercase tracking-wider text-[rgba(12,8,5,0.66)]">
                        {pillarLabel[k]} {fp.pillarSuffix}
                      </div>
                      <div className="mt-1 text-surface-950 text-sm font-semibold">
                        {p.heavenlyStem} · {p.earthlyBranch}
                      </div>
                      <div className="text-xs text-secondary">
                        {p.animal} · {p.element}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="rounded-xl border divider bg-[rgba(255,252,245,0.78)] p-4">
                <div className="text-xs uppercase tracking-wider text-[rgba(12,8,5,0.66)]">
                  {fp.dayMaster}
                </div>
                <div className="mt-1 text-surface-950 font-medium">{result.dayMaster}</div>
              </div>
              {result.interpretation && (
                <div className="rounded-xl border divider bg-[rgba(255,252,245,0.78)] p-4">
                  <p className="text-sm text-emphasis whitespace-pre-wrap leading-relaxed">
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
