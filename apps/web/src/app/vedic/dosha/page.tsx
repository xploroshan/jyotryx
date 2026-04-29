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
  const { t, locale } = useTranslation();
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
      .get<DoshaData>(`/astrology/dosha?locale=${locale}`)
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
  }, [isAuthenticated, locale, t.kundli.generateFailed]);

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
        return 'bg-white/10 text-surface-50/60 border-white/10';
    }
  };

  const featureName = (t as any).traditionsUi?.vedic?.features?.dosha || 'Dosha Analysis';
  const traditionName = (t as any).traditionsUi?.vedic?.name || 'Vedic';

  return (
    <div className="mx-auto max-w-4xl px-5 sm:px-8 py-8 pt-4 fade-in-up">
      <nav className="mb-5 text-sm text-surface-50/40">
        <Link href={`/${cfg.slug}`} className="hover:text-surface-50 transition-colors">
          {traditionName}
        </Link>{' '}
        <span className="text-surface-50/20">/</span>{' '}
        <span className="text-surface-50/60">{featureName}</span>
      </nav>

      <section
        className={`rounded-3xl bg-gradient-to-br ${cfg.heroClass} border border-white/[0.06] px-8 sm:px-10 py-10 mb-8`}
      >
        <div className="flex items-center gap-5">
          <span className="text-4xl leading-none" aria-hidden>
            🔥
          </span>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-surface-50 tracking-tight">
              {featureName}
            </h1>
            <p className="mt-2 text-sm text-surface-50/50 leading-relaxed">{t.kundli.doshaNote}</p>
          </div>
        </div>
      </section>

      {!isAuthenticated && (
        <div className="rounded-2xl bg-white/[0.02] border border-white/[0.06] p-10 text-center">
          <p className="text-surface-50/50 mb-5">{t.kundli.loginRequired}</p>
          <Link
            href="/auth?mode=login"
            className="inline-block px-6 py-2.5 btn-primary rounded-full text-sm"
          >
            {t.common.login}
          </Link>
        </div>
      )}

      {isAuthenticated && !hasBirthDetails && (
        <div className="rounded-2xl bg-white/[0.02] border border-white/[0.06] p-10 text-center">
          <p className="text-surface-50/50 mb-5">{t.kundli.doshaComplete}</p>
          <Link
            href="/profile"
            className="inline-block px-6 py-2.5 btn-primary rounded-full text-sm"
          >
            {t.featurePages.vedicDosha.profile}
          </Link>
        </div>
      )}

      {isAuthenticated && hasBirthDetails && loading && (
        <div className="rounded-2xl bg-white/[0.02] border border-white/[0.06] p-10 text-center text-surface-50/40 text-sm">
          {t.common.loading}
        </div>
      )}

      {error && (
        <div className="rounded-2xl bg-red-500/5 border border-red-500/20 p-6 text-center text-red-300 text-sm">
          {error}
        </div>
      )}

      {data?.doshas && data.doshas.length > 0 && (
        <div className="space-y-4">
          {data.doshas.map((d, i) => (
            <div key={i} className="rounded-2xl bg-white/[0.02] border border-white/[0.06] p-6 sm:p-8">
              <div className="flex items-start justify-between gap-3 mb-4">
                <h3 className="font-semibold text-surface-50 text-lg">
                  {d.name}
                </h3>
                <span
                  className={`shrink-0 text-[11px] px-3 py-1 rounded-full border font-medium ${severityChipClass(d)}`}
                >
                  {severityLabel(d)}
                </span>
              </div>
              <p className="text-sm text-surface-50/50 leading-relaxed mb-4">
                {d.description}
              </p>
              {d.remedies && d.remedies.length > 0 && (
                <div className="rounded-xl bg-white/[0.03] border border-white/[0.05] p-4 sm:p-5">
                  <p className="text-[11px] uppercase tracking-widest text-primary-400 font-medium mb-2">
                    {t.kundli.remedies}
                  </p>
                  <ul className="text-sm text-surface-50/60 list-disc pl-5 space-y-1.5">
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
