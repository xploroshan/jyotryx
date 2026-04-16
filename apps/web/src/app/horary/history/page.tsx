'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuthStore } from '@/lib/store';
import { useTranslation } from '@/i18n';
import FeaturePageShell from '@/components/tradition/FeaturePageShell';
import {
  loadHoraryHistory,
  deleteHoraryRecord,
  clearHoraryHistory,
  type HoraryRecord,
} from '../_history';

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

/**
 * Horary question history — persisted client-side per user. Users can
 * review past questions, expand to see the chart + judgment again, and
 * delete individual entries or clear the full history.
 */
export default function HoraryHistoryPage() {
  const { t } = useTranslation();
  const { user, isAuthenticated } = useAuthStore();
  const [records, setRecords] = useState<HoraryRecord[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setRecords(loadHoraryHistory(user?.id));
    setHydrated(true);
  }, [user?.id]);

  const remove = (id: string) => {
    deleteHoraryRecord(user?.id, id);
    setRecords((r) => r.filter((x) => x.id !== id));
  };

  const clearAll = () => {
    clearHoraryHistory(user?.id);
    setRecords([]);
  };

  return (
    <FeaturePageShell
      traditionId="HORARY"
      featureKey="traditionsUi.horary.features.history"
      icon="📚"
      description="Review past questions and judgments"
    >
      {!isAuthenticated ? (
        <div className="glass rounded-2xl p-8 text-center text-sm text-white/70">
          {t.kundli.loginRequired}
        </div>
      ) : !hydrated ? (
        <div className="glass rounded-2xl p-8 text-center text-sm text-white/60">
          {t.common.loading}
        </div>
      ) : records.length === 0 ? (
        <div className="glass rounded-2xl p-8 text-center">
          <p className="text-sm text-white/70 mb-4">No questions asked yet.</p>
          <Link
            href="/horary/ask"
            className="inline-block px-5 py-2 btn-primary rounded-lg text-sm"
          >
            Ask a question
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs text-white/50">
              {records.length} {records.length === 1 ? 'question' : 'questions'}
            </p>
            <button
              type="button"
              onClick={clearAll}
              className="text-xs text-white/50 hover:text-red-300 transition"
            >
              Clear all
            </button>
          </div>

          {records.map((r) => {
            const isOpen = expandedId === r.id;
            return (
              <div
                key={r.id}
                className="glass rounded-2xl overflow-hidden transition-all"
              >
                <button
                  type="button"
                  onClick={() => setExpandedId(isOpen ? null : r.id)}
                  className="w-full text-left px-5 py-4 hover:bg-white/[0.03] flex items-start justify-between gap-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-white font-medium truncate">
                      {r.question}
                    </p>
                    <p className="text-[11px] text-white/45 mt-1">
                      {formatDate(r.askedAt)} · Asc {r.chart.ascendant.sign}
                    </p>
                  </div>
                  <span className="text-xs text-white/40 shrink-0" aria-hidden>
                    {isOpen ? '▲' : '▼'}
                  </span>
                </button>
                {isOpen && (
                  <div className="border-t border-white/[0.06] bg-black/20 px-5 py-4 space-y-3">
                    <div className="text-xs space-y-1">
                      <div className="text-white/50">
                        Ascendant:{' '}
                        <span className="text-white/80">
                          {r.chart.ascendant.sign} (
                          {r.chart.ascendant.degree.toFixed(2)}°)
                        </span>
                      </div>
                      <div className="text-white/50">
                        Querent:{' '}
                        <span className="text-white/80">
                          {r.chart.significators.querent}
                        </span>
                      </div>
                      <div className="text-white/50">
                        Quesited:{' '}
                        <span className="text-white/80">
                          {r.chart.significators.quesited}
                        </span>
                      </div>
                      <div className="text-white/50">
                        Moon:{' '}
                        <span className="text-white/80">
                          {r.chart.significators.moon}
                        </span>
                      </div>
                    </div>
                    <p className="text-sm text-white/85 whitespace-pre-wrap leading-relaxed">
                      {r.judgment}
                    </p>
                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={() => remove(r.id)}
                        className="text-xs text-white/40 hover:text-red-300 transition"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </FeaturePageShell>
  );
}
