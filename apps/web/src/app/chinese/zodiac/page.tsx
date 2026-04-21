'use client';

import { useState } from 'react';
import { useTranslation } from '@/i18n';
import { useAuthStore } from '@/lib/store';
import { api } from '@/lib/api';
import TraditionFeatureStub from '@/components/tradition/TraditionFeatureStub';

interface ChineseZodiacResponse {
  animal: string;
  element: string;
  yinYang: string;
  traits: string[];
  interpretation?: string;
  year?: number;
}

export default function ChineseZodiacPage() {
  const { locale } = useTranslation();
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
      setError(err?.message ?? 'Request failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <TraditionFeatureStub
      traditionId="CHINESE"
      featureKey="traditionsUi.chinese.features.zodiac"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs text-white/60 mb-1">Birth year</label>
          <input
            type="number"
            min={1900}
            max={new Date().getFullYear()}
            value={year}
            onChange={(e) => setYear(e.target.value)}
            required
            className="w-full bg-white/[0.04] border divider rounded-lg px-3 py-2 text-sm text-white"
          />
        </div>
        <button
          type="submit"
          disabled={loading || !isAuthenticated}
          className="btn-primary rounded-lg px-4 py-2 text-sm disabled:opacity-50"
        >
          {loading ? 'Processing...' : 'Get My Animal'}
        </button>
        {error && <p className="text-xs text-red-400">{error}</p>}
      </form>

      {result && (
        <div className="mt-6 rounded-xl border divider bg-white/[0.03] p-4 space-y-2">
          <div className="text-2xl font-semibold text-white">
            {result.animal} · {result.element}
          </div>
          {result.yinYang && (
            <div className="text-sm text-white/60">{result.yinYang}</div>
          )}
          {result.traits && result.traits.length > 0 && (
            <ul className="list-disc list-inside text-sm text-white/80">
              {result.traits.map((tt) => <li key={tt}>{tt}</li>)}
            </ul>
          )}
          {result.interpretation && (
            <p className="text-sm text-white/70 whitespace-pre-wrap mt-2">
              {result.interpretation}
            </p>
          )}
        </div>
      )}
    </TraditionFeatureStub>
  );
}
