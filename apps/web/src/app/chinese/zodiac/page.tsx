'use client';

import { useState } from 'react';
import { useTranslation } from '@/i18n';
import { useAuthStore } from '@/lib/store';
import { api } from '@/lib/api';
import TraditionFeatureStub from '@/components/tradition/TraditionFeatureStub';
import Interpretation from '@/components/interpretation/Interpretation';

interface ChineseZodiacResponse {
  animal: string;
  element: string;
  yinYang: string;
  traits: string[];
  interpretation?: string;
  year?: number;
}

export default function ChineseZodiacPage() {
  const { t, locale } = useTranslation();
  const fp = t.featurePages.chineseZodiac;
  const { user, accessToken, isAuthenticated } = useAuthStore();
  const [year, setYear] = useState<string>(
    user?.dateOfBirth ? String(new Date(user.dateOfBirth).getFullYear()) : '',
  );
  const [result, setResult] = useState<ChineseZodiacResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const y = Number(year);
      const res = await api.get<ChineseZodiacResponse>(
        `/astrology/chinese-zodiac/${y}?locale=${locale}`,
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
      traditionId="CHINESE"
      featureKey="traditionsUi.chinese.features.zodiac"
      descriptionKey="featurePages.chineseZodiac.description"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs text-secondary mb-1">{fp.birthYear}</label>
          <input
            type="number"
            min={1900}
            max={new Date().getFullYear()}
            value={year}
            onChange={(e) => setYear(e.target.value)}
            required
            className="w-full bg-[rgba(255,252,245,0.86)] border divider rounded-lg px-3 py-2 text-sm text-surface-950"
          />
        </div>
        <button
          type="submit"
          disabled={loading || !isAuthenticated}
          className="btn-primary rounded-lg px-4 py-2 text-sm disabled:opacity-50"
        >
          {loading ? t.common.processing : fp.submit}
        </button>
        {error && <p className="text-xs text-red-400">{error}</p>}
      </form>

      {result && (
        <div className="mt-6 rounded-xl border divider bg-[rgba(255,252,245,0.78)] p-4 space-y-2">
          <div className="text-2xl font-semibold text-surface-950">
            {result.animal} · {result.element}
          </div>
          {result.yinYang && (
            <div className="text-sm text-secondary">{result.yinYang}</div>
          )}
          {result.traits && result.traits.length > 0 && (
            <ul className="list-disc list-inside text-sm text-emphasis">
              {result.traits.map((tt) => <li key={tt}>{tt}</li>)}
            </ul>
          )}
          {result.interpretation && (
            <p className="text-sm text-emphasis whitespace-pre-wrap mt-2">
              {result.interpretation}
            </p>
          )}
        </div>
      )}

      {result && (
        <Interpretation
          domain="chinese-zodiac"
          className="mt-4"
          input={{
            animal: result.animal,
            element: result.element,
            yinYang: result.yinYang,
            traits: result.traits,
            year: result.year,
          }}
        />
      )}
    </TraditionFeatureStub>
  );
}
