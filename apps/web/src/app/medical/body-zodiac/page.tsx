'use client';

import { useState } from 'react';
import { useTranslation } from '@/i18n';
import { useAuthStore } from '@/lib/store';
import { api } from '@/lib/api';
import TraditionFeatureStub from '@/components/tradition/TraditionFeatureStub';

interface BodyZodiacRow {
  sign: string;
  bodyParts: string[];
  element: string;
  guidance?: string;
}

interface BodyZodiacResponse {
  mapping: BodyZodiacRow[];
}

export default function MedicalBodyZodiacPage() {
  const { t, locale } = useTranslation();
  const fp = t.featurePages.medicalBodyZodiac;
  const { accessToken } = useAuthStore();
  const [result, setResult] = useState<BodyZodiacResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get<BodyZodiacResponse>(
        `/astrology/medical/body-zodiac?locale=${locale}`,
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
      traditionId="MEDICAL"
      featureKey="traditionsUi.medical.features.bodyZodiac"
      descriptionKey="featurePages.medicalBodyZodiac.description"
    >
      <button
        onClick={load}
        disabled={loading}
        className="btn-primary rounded-lg px-4 py-2 text-sm disabled:opacity-50"
      >
        {loading ? t.common.loading : fp.showMap}
      </button>
      {error && <p className="mt-2 text-xs text-red-400">{error}</p>}

      {result && (
        <ul className="mt-6 space-y-2">
          {result.mapping.map((row) => (
            <li
              key={row.sign}
              className="rounded-xl border divider bg-[rgba(255,252,245,0.78)] p-3 text-sm text-emphasis"
            >
              <div className="flex items-baseline justify-between">
                <span className="font-semibold text-surface-950">{row.sign}</span>
                <span className="text-xs text-[rgba(12,8,5,0.72)]">{row.element}</span>
              </div>
              <div className="mt-1 text-emphasis">{row.bodyParts.join(', ')}</div>
              {row.guidance && (
                <div className="mt-1 text-xs text-[rgba(12,8,5,0.72)]">{row.guidance}</div>
              )}
            </li>
          ))}
        </ul>
      )}
    </TraditionFeatureStub>
  );
}
