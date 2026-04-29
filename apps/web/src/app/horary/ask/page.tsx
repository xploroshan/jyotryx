'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useTranslation } from '@/i18n';
import { useAuthStore } from '@/lib/store';
import { api } from '@/lib/api';
import TraditionFeatureStub from '@/components/tradition/TraditionFeatureStub';
import { saveHoraryRecord } from '../_history';

interface HoraryResponse {
  question: string;
  askedAt: string;
  chart: {
    ascendant: { sign: string; degree: number };
    significators: { querent: string; quesited: string; moon: string };
  };
  judgment: string;
}

export default function HoraryAskPage() {
  const { t, locale } = useTranslation();
  const fp = t.featurePages.horaryAsk;
  const { user, accessToken, isAuthenticated } = useAuthStore();
  const [question, setQuestion] = useState('');
  const [result, setResult] = useState<HoraryResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await api.post<HoraryResponse>(
        '/astrology/horary/ask',
        { question, locale },
        { token: accessToken ?? undefined },
      );
      setResult(res);
      // Persist to client-side history so the user can revisit this reading.
      saveHoraryRecord(user?.id, {
        question: res.question,
        askedAt: res.askedAt,
        chart: res.chart,
        judgment: res.judgment,
      });
    } catch (err: any) {
      setError(err?.message ?? t.featurePages.requestFailed);
    } finally {
      setLoading(false);
    }
  };

  return (
    <TraditionFeatureStub
      traditionId="HORARY"
      featureKey="traditionsUi.horary.features.ask"
      descriptionKey="featurePages.horaryAsk.description"
    >
      {!isAuthenticated ? (
        <p className="text-sm text-surface-900/60 text-center py-6">
          {fp.loginPrompt}
        </p>
      ) : (
        <>
          <form onSubmit={handleSubmit} className="space-y-4">
            <textarea
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder={fp.placeholder}
              rows={4}
              required
              className="w-full bg-surface-900/[0.04] border divider rounded-lg px-3 py-2 text-sm text-surface-900"
            />
            <button
              type="submit"
              disabled={loading || !question.trim()}
              className="btn-primary rounded-lg px-4 py-2 text-sm disabled:opacity-50"
            >
              {loading ? fp.casting : fp.submit}
            </button>
            {error && <p className="text-xs text-red-400">{error}</p>}
          </form>

          {result && (
            <div className="mt-6 space-y-3">
              <div className="rounded-xl border divider bg-surface-900/[0.03] p-4 text-sm text-surface-900/80">
                <div className="text-xs uppercase tracking-wider text-surface-900/40 mb-1">
                  {fp.question}
                </div>
                <div>{result.question}</div>
              </div>
              <div className="rounded-xl border divider bg-surface-900/[0.03] p-4 text-sm text-surface-900/80">
                <div className="text-xs uppercase tracking-wider text-surface-900/40 mb-1">
                  {fp.chart}
                </div>
                <div>
                  {fp.ascendant}: {result.chart.ascendant.sign}{' '}
                  ({result.chart.ascendant.degree.toFixed(2)}°)
                </div>
                <div>{fp.querent}: {result.chart.significators.querent}</div>
                <div>{fp.quesited}: {result.chart.significators.quesited}</div>
                <div>{fp.moon}: {result.chart.significators.moon}</div>
              </div>
              <div className="rounded-xl border divider bg-surface-900/[0.03] p-4 text-sm text-surface-900/80 whitespace-pre-wrap">
                {result.judgment}
              </div>
              <div className="text-right">
                <Link
                  href="/horary/history"
                  className="text-xs text-surface-900/50 hover:text-surface-900 transition"
                >
                  {fp.viewHistory}
                </Link>
              </div>
            </div>
          )}
        </>
      )}
    </TraditionFeatureStub>
  );
}
