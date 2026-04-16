'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useTranslation } from '@/i18n';
import { useAuthStore } from '@/lib/store';
import { api } from '@/lib/api';
import { WEB_TRADITIONS } from '@/lib/traditions';

interface DoshaEntry {
  name: string;
  present: boolean;
  severity: 'none' | 'mild' | 'moderate' | 'severe' | string;
  description: string;
  remedies: string[];
}

interface DoshaData {
  userId: string;
  doshas: DoshaEntry[];
}

/**
 * Vedic Dosha analysis — dedicated page.
 *
 * Calls `GET /astrology/dosha` which performs deterministic detection
 * (Mangal, Kaal Sarp, Pitra, etc.) from the authenticated user's saved
 * birth details. Profiles without DOB see a prompt to complete their
 * profile; the API also returns that shape so we just render it.
 */
export default function VedicDoshaPage() {
  const { t } = useTranslation();
  const { isAuthenticated, user } = useAuthStore();
  const cfg = WEB_TRADITIONS.VEDIC;

  const [data, setData] = useState<DoshaData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const hasBirthDetails = Boolean(user?.dateOfBirth);

  useEffect(() => {
    if (!isAuthenticated) return;
    let cancelled = false;
    setLoading(true);
    setError('');
    api
      .get<DoshaData>('/astrology/dosha')
      .then((res) => {
        if (!cancelled) setData(res);
      })
      .catch((err: any) => {
        if (!cancelled) setError(err?.message || t.kundli.generateFailed);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, t.kundli.generateFailed]);

  const severityLabel = (d: DoshaEntry): string => {
    if (!d.present) return t.kundli.absent;
    switch (d.severity) {
      case 'mild':
        return t.kundli.severityMild;
      case 'moderate':
        return t.kundli.severityModerate;
      case 'severe':
        return t.kundli.severitySevere;
      default:
        return t.kundli.severityNone;
    }
  };

  const severityChipClass = (d: DoshaEntry): string => {
    if (!d.present) return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';
    switch (d.severity) {
      case 'mild':
        return 'bg-accent-500/20 text-accent-300 border-accent-500/30';
      case 'moderate':
        return 'bg-amber-500/20 text-amber-300 border-amber-500/30';
      case 'severe':
        return 'bg-red-500/20 text-red-300 border-red-500/30';
      default:
        return 'bg-white/10 text-white/60 border-white/10';
    }
  };

  const featureName = (t as any).traditionsUi?.vedic?.features?.dosha || 'Dosha Analysis';
  const traditionName = (t as any).traditionsUi?.vedic?.name || 'Vedic';

  return (
    <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-8 pt-4">
      <nav className="mb-4 text-xs text-white/50">
        <Link href={`/${cfg.slug}`} className="hover:text-white">
          {traditionName}
        </Link>{' '}
        / <span className="text-white/70">{featureName}</span>
      </nav>

      <section
        className={`rounded-3xl bg-gradient-to-br ${cfg.heroClass} ring-1 px-6 sm:px-10 py-8 mb-6`}
      >
        <div className="flex items-center gap-4">
          <span className="text-4xl leading-none" aria-hidden>
            🔥
          </span>
          <div>
            <h1 className="text-xl sm:text-2xl font-semibold text-white tracking-tight">
              {featureName}
            </h1>
            <p className="mt-1 text-sm text-white/70">{t.kundli.doshaNote}</p>
          </div>
        </div>
      </section>

      {!isAuthenticated && (
        <div className="glass rounded-2xl p-8 text-center">
          <p className="text-white/70 mb-4">{t.kundli.loginRequired}</p>
          <Link
            href="/auth?mode=login"
            className="inline-block px-5 py-2 btn-primary rounded-lg text-sm"
          >
            {t.common.login}
          </Link>
        </div>
      )}

      {isAuthenticated && !hasBirthDetails && (
        <div className="glass rounded-2xl p-8 text-center">
          <p className="text-white/70 mb-4">{t.kundli.doshaComplete}</p>
          <Link
            href="/profile"
            className="inline-block px-5 py-2 btn-primary rounded-lg text-sm"
          >
            Profile
          </Link>
        </div>
      )}

      {isAuthenticated && hasBirthDetails && loading && (
        <div className="glass rounded-2xl p-8 text-center text-white/60 text-sm">
          {t.common.loading}
        </div>
      )}

      {error && (
        <div className="glass rounded-2xl p-6 text-center text-red-300 text-sm border-red-500/30">
          {error}
        </div>
      )}

      {data?.doshas && data.doshas.length > 0 && (
        <div className="space-y-4">
          {data.doshas.map((d, i) => (
            <div key={i} className="glass rounded-2xl p-5 sm:p-6">
              <div className="flex items-start justify-between gap-3 mb-3">
                <h3 className="font-semibold text-white text-base sm:text-lg">
                  {d.name}
                </h3>
                <span
                  className={`shrink-0 text-[11px] px-2.5 py-1 rounded-full border ${severityChipClass(d)}`}
                >
                  {severityLabel(d)}
                </span>
              </div>
              <p className="text-sm text-white/70 leading-relaxed mb-3">
                {d.description}
              </p>
              {d.remedies && d.remedies.length > 0 && (
                <div className="rounded-xl bg-white/[0.04] border border-white/[0.06] p-3 sm:p-4">
                  <p className="text-[11px] uppercase tracking-wide text-primary-400 font-semibold mb-1.5">
                    {t.kundli.remedies}
                  </p>
                  <ul className="text-xs sm:text-sm text-white/75 list-disc pl-5 space-y-1">
                    {d.remedies.map((r, j) => (
                      <li key={j}>{r}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
