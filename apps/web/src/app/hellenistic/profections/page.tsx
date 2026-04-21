'use client';

import { useState } from 'react';
import { useTranslation } from '@/i18n';
import { useAuthStore } from '@/lib/store';
import { api } from '@/lib/api';
import TraditionFeatureStub from '@/components/tradition/TraditionFeatureStub';

interface ProfectionsResponse {
  ageYears: number;
  profectedHouse: number;
  profectedSign: string;
  lordOfYear: string;
  interpretation?: string;
}

export default function HellenisticProfectionsPage() {
  const { t, locale } = useTranslation();
  const fp = t.featurePages.hellenisticProfections;
  const { user, accessToken, isAuthenticated } = useAuthStore();
  const [dateOfBirth, setDateOfBirth] = useState(user?.dateOfBirth?.slice(0, 10) ?? '');
  const [result, setResult] = useState<ProfectionsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await api.post<ProfectionsResponse>(
        '/astrology/hellenistic/profections',
        { dateOfBirth, locale },
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
      traditionId="HELLENISTIC"
      featureKey="traditionsUi.hellenistic.features.profections"
      descriptionKey="featurePages.hellenisticProfections.description"
    >
      {!isAuthenticated ? (
        <p className="text-sm text-white/60 text-center py-6">
          {fp.loginPrompt}
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
            <button
              type="submit"
              disabled={loading}
              className="btn-primary rounded-lg px-4 py-2 text-sm disabled:opacity-50"
            >
              {loading ? t.common.processing : fp.submit}
            </button>
            {error && <p className="text-xs text-red-400">{error}</p>}
          </form>

          {result && (
            <div className="mt-6 rounded-xl border divider bg-white/[0.03] p-4 space-y-2 text-sm text-white/80">
              <div>{fp.age}: {result.ageYears}</div>
              <div>{fp.profectedHouse}: {result.profectedHouse}</div>
              <div>{fp.profectedSign}: {result.profectedSign}</div>
              <div>{fp.lordOfYear}: {result.lordOfYear}</div>
              {result.interpretation && (
                <p className="whitespace-pre-wrap mt-2">{result.interpretation}</p>
              )}
            </div>
          )}
        </>
      )}
    </TraditionFeatureStub>
  );
}
