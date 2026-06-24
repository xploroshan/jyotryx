'use client';

import { useEffect, useState } from 'react';
import { useAuthStore } from '@/lib/store';
import { useTranslation } from '@/i18n';
import { api } from '@/lib/api';
import FeaturePageShell from '@/components/tradition/FeaturePageShell';

interface ZRResponse {
  ageYears: number;
  majorPeriod: { sign: string; lord: string; description: string };
  minorPeriod: { sign: string; lord: string; description: string };
  interpretation: string;
}

/**
 * Hellenistic Zodiacal Releasing — shows the current 12-year chapter
 * and annual sub-period for the logged-in user, using their saved DOB.
 */
export default function HellenisticZodiacalReleasingPage() {
  const { t, locale } = useTranslation();
  const fp = t.featurePages.hellenisticZodiacalReleasing;
  const { user, accessToken, isAuthenticated } = useAuthStore();
  const [result, setResult] = useState<ZRResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const hasDob = Boolean(user?.dateOfBirth);

  useEffect(() => {
    if (!isAuthenticated || !hasDob) return;
    let cancelled = false;
    setLoading(true);
    setError('');
    api
      .post<ZRResponse>(
        '/astrology/hellenistic/zodiacal-releasing',
        { dateOfBirth: user!.dateOfBirth, locale },
        { token: accessToken ?? undefined },
      )
      .then((res) => {
        if (!cancelled) setResult(res);
      })
      .catch((err: any) => {
        if (!cancelled) setError(err?.message ?? t.kundli.generateFailed);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, hasDob, user, accessToken, locale, t.kundli.generateFailed]);

  return (
    <FeaturePageShell
      traditionId="HELLENISTIC"
      featureKey="traditionsUi.hellenistic.features.zodiacalReleasing"
      descriptionKey="featurePages.hellenisticZodiacalReleasing.description"
    >
      {!isAuthenticated && (
        <div className="glass rounded-2xl p-8 text-center text-sm text-emphasis">
          {t.kundli.loginRequired}
        </div>
      )}
      {isAuthenticated && !hasDob && (
        <div className="glass rounded-2xl p-8 text-center text-sm text-emphasis">
          {t.kundli.doshaComplete}
        </div>
      )}
      {loading && (
        <div className="glass rounded-2xl p-8 text-center text-sm text-secondary">
          {t.common.loading}
        </div>
      )}
      {error && (
        <div className="glass rounded-2xl p-6 text-sm text-red-300 text-center">
          {error}
        </div>
      )}
      {result && (
        <div className="space-y-4">
          <div className="glass-strong rounded-2xl p-6 text-center">
            <p className="text-[10px] uppercase tracking-wide text-[rgba(12,8,5,0.72)]">
              {fp.age}
            </p>
            <p className="text-4xl font-bold text-surface-950 mt-1">{result.ageYears}</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="glass rounded-2xl p-5">
              <p className="text-[10px] uppercase tracking-wide text-[rgba(12,8,5,0.72)]">
                {fp.majorPeriod}
              </p>
              <p className="text-xl font-semibold text-surface-950 mt-1">
                {result.majorPeriod.sign}
              </p>
              <p className="text-xs text-secondary mt-1">
                {fp.lord}: {result.majorPeriod.lord}
              </p>
              <p className="text-xs text-emphasis mt-3">
                {result.majorPeriod.description}
              </p>
            </div>
            <div className="glass rounded-2xl p-5">
              <p className="text-[10px] uppercase tracking-wide text-[rgba(12,8,5,0.72)]">
                {fp.annualSubPeriod}
              </p>
              <p className="text-xl font-semibold text-surface-950 mt-1">
                {result.minorPeriod.sign}
              </p>
              <p className="text-xs text-secondary mt-1">
                {fp.lord}: {result.minorPeriod.lord}
              </p>
              <p className="text-xs text-emphasis mt-3">
                {result.minorPeriod.description}
              </p>
            </div>
          </div>

          <div className="glass rounded-2xl p-5 text-sm text-emphasis leading-relaxed">
            {result.interpretation}
          </div>
        </div>
      )}
    </FeaturePageShell>
  );
}
