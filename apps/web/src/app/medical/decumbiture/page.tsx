'use client';

import { useState } from 'react';
import { useAuthStore } from '@/lib/store';
import { useTranslation } from '@/i18n';
import { api } from '@/lib/api';
import FeaturePageShell from '@/components/tradition/FeaturePageShell';

interface DecumbitureResponse {
  decumbitureAt: string;
  symptoms: string | null;
  ascendant: { sign: string; degree: number };
  ascendantElement: string;
  sixthHouseSign: string;
  moon: { sign: string; degree: number } | null;
  guidance: string;
  interpretation: string;
}

const ELEMENT_BG: Record<string, string> = {
  Fire: 'from-red-500/15 to-red-500/5 border-red-500/30',
  Earth: 'from-amber-700/15 to-amber-700/5 border-amber-700/30',
  Air: 'from-sky-500/15 to-sky-500/5 border-sky-500/30',
  Water: 'from-blue-500/15 to-blue-500/5 border-blue-500/30',
};

/**
 * Medical astrology Decumbiture — a chart cast for the moment symptoms
 * began (or the patient took to bed). Surfaces the ascendant's element,
 * the 6th house of illness and the Moon's sign for prognosis.
 */
export default function MedicalDecumbiturePage() {
  const { t, locale } = useTranslation();
  const { accessToken, isAuthenticated } = useAuthStore();
  const nowIso = new Date().toISOString();
  const [date, setDate] = useState(nowIso.slice(0, 10));
  const [time, setTime] = useState(nowIso.slice(11, 16));
  const [symptoms, setSymptoms] = useState('');
  const [result, setResult] = useState<DecumbitureResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    setError('');
    try {
      const res = await api.post<DecumbitureResponse>(
        '/astrology/medical/decumbiture',
        {
          decumbitureDate: date,
          decumbitureTime: time,
          symptomsDescription: symptoms || undefined,
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
      traditionId="MEDICAL"
      featureKey="traditionsUi.medical.features.decumbiture"
      icon="🛏️"
      description="Chart cast for onset of illness · classical medical reading"
    >
      {!isAuthenticated ? (
        <div className="glass rounded-2xl p-8 text-center text-sm text-white/70">
          {t.kundli.loginRequired}
        </div>
      ) : (
        <div className="glass rounded-2xl p-5 sm:p-6 mb-4">
          <form onSubmit={submit} className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="text-[11px] uppercase tracking-wide text-white/50">
                  Onset date
                </span>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  required
                  className="surface-input rounded-lg px-3 py-2 text-sm w-full mt-1"
                />
              </label>
              <label className="block">
                <span className="text-[11px] uppercase tracking-wide text-white/50">
                  Onset time
                </span>
                <input
                  type="time"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  required
                  className="surface-input rounded-lg px-3 py-2 text-sm w-full mt-1"
                />
              </label>
            </div>
            <label className="block">
              <span className="text-[11px] uppercase tracking-wide text-white/50">
                Symptoms (optional)
              </span>
              <textarea
                value={symptoms}
                onChange={(e) => setSymptoms(e.target.value)}
                rows={2}
                placeholder="e.g. fever, headache"
                className="surface-input rounded-lg px-3 py-2 text-sm w-full mt-1 resize-none"
              />
            </label>
            <div className="flex items-center justify-between gap-3">
              <button
                type="submit"
                disabled={loading}
                className="btn-primary rounded-lg px-5 py-2 text-sm disabled:opacity-50"
              >
                {loading ? t.common.loading : 'Cast chart'}
              </button>
              {error && <p className="text-xs text-red-400">{error}</p>}
            </div>
          </form>
        </div>
      )}

      {result && (
        <div className="space-y-4">
          <div
            className={`rounded-2xl border bg-gradient-to-br ${
              ELEMENT_BG[result.ascendantElement] ??
              'from-white/10 to-white/[0.02] border-white/10'
            } p-6`}
          >
            <p className="text-[10px] uppercase tracking-wide text-white/50">
              Ascendant (patient)
            </p>
            <p className="text-2xl font-bold text-white mt-1">
              {result.ascendant.sign}
            </p>
            <p className="text-xs text-white/70 mt-1">
              Element: {result.ascendantElement}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="glass rounded-2xl p-4">
              <p className="text-[10px] uppercase tracking-wide text-white/50">
                6th House of illness
              </p>
              <p className="text-lg font-semibold text-white mt-1">
                {result.sixthHouseSign}
              </p>
            </div>
            {result.moon && (
              <div className="glass rounded-2xl p-4">
                <p className="text-[10px] uppercase tracking-wide text-white/50">
                  Moon (progression)
                </p>
                <p className="text-lg font-semibold text-white mt-1">
                  {result.moon.sign}{' '}
                  <span className="text-xs text-white/50">
                    {result.moon.degree.toFixed(1)}°
                  </span>
                </p>
              </div>
            )}
          </div>

          <div className="glass-strong rounded-2xl p-5">
            <p className="text-[10px] uppercase tracking-wide text-white/50 mb-2">
              Guidance
            </p>
            <p className="text-sm text-white/85">{result.guidance}</p>
          </div>

          <div className="glass rounded-2xl p-5 text-sm text-white/80 leading-relaxed">
            {result.interpretation}
          </div>

          {result.symptoms && (
            <div className="glass rounded-2xl p-4 text-xs text-white/60">
              <span className="text-white/40 uppercase tracking-wide">
                Reported symptoms:
              </span>{' '}
              {result.symptoms}
            </div>
          )}
        </div>
      )}
    </FeaturePageShell>
  );
}
