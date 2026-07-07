'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useTranslation } from '@/i18n';
import { useAuthStore } from '@/lib/store';
import { api } from '@/lib/api';
import { WEB_TRADITIONS } from '@/lib/traditions';
import EditorialHero from '@/components/editorial/EditorialHero';
import { TraditionGlyph } from '@/components/icons';
import Interpretation from '@/components/interpretation/Interpretation';
import { type RemedyTempleSet } from '@/components/remedies/Remedies';
import Mitigation, { type MitigationPlan } from '@/components/mitigation/Mitigation';

interface DoshaEntry {
  key?: string;
  name: string;
  present: boolean;
  severity: 'none' | 'mild' | 'moderate' | 'severe' | string;
  description: string;
  remedies: string[];
  remedyTemples?: RemedyTempleSet;
  mitigation?: MitigationPlan;
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
        return 'bg-[rgba(12,8,5,0.07)] text-secondary border-[rgba(12,8,5,0.10)]';
    }
  };

  const featureName = (t as any).traditionsUi?.vedic?.features?.dosha || 'Dosha Analysis';
  const traditionName = (t as any).traditionsUi?.vedic?.name || 'Vedic';

  return (
    <div>
      <EditorialHero
        tint="amber"
        eyebrow={`${traditionName} · ${featureName}`}
        eyebrowIcon={<TraditionGlyph id="VEDIC" size={18} weight={1.4} />}
        headline={`{em}${featureName}{/em}`}
        tagline={t.kundli.doshaNote}
      />

      <div className="mx-auto max-w-4xl px-5 sm:px-8 py-8 fade-in-up">
        <nav className="mb-5 text-sm text-[rgba(12,8,5,0.66)]">
          <Link href={`/${cfg.slug}`} className="hover:text-surface-950 transition-colors">
            {traditionName}
          </Link>{' '}
          <span className="text-[rgba(12,8,5,0.66)]">/</span>{' '}
          <span className="text-secondary">{featureName}</span>
        </nav>

      {!isAuthenticated && (
        <div className="rounded-2xl bg-[rgba(255,252,245,0.70)] border border-[rgba(12,8,5,0.08)] p-10 text-center">
          <p className="text-[rgba(12,8,5,0.72)] mb-5">{t.kundli.loginRequired}</p>
          <Link
            href="/auth?mode=login"
            className="inline-block px-6 py-2.5 btn-primary rounded-full text-sm"
          >
            {t.common.login}
          </Link>
        </div>
      )}

      {isAuthenticated && !hasBirthDetails && (
        <div className="rounded-2xl bg-[rgba(255,252,245,0.70)] border border-[rgba(12,8,5,0.08)] p-10 text-center">
          <p className="text-[rgba(12,8,5,0.72)] mb-5">{t.kundli.doshaComplete}</p>
          <Link
            href="/profile"
            className="inline-block px-6 py-2.5 btn-primary rounded-full text-sm"
          >
            {t.featurePages.vedicDosha.profile}
          </Link>
        </div>
      )}

      {isAuthenticated && hasBirthDetails && loading && (
        <div className="rounded-2xl bg-[rgba(255,252,245,0.70)] border border-[rgba(12,8,5,0.08)] p-10 text-center text-[rgba(12,8,5,0.66)] text-sm">
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
            <div key={i} className="rounded-2xl bg-[rgba(255,252,245,0.70)] border border-[rgba(12,8,5,0.08)] p-6 sm:p-8">
              <div className="flex items-start justify-between gap-3 mb-4">
                <h3 className="font-semibold text-surface-950 text-lg">
                  {d.name}
                </h3>
                <span
                  className={`shrink-0 text-[11px] px-3 py-1 rounded-full border font-medium ${severityChipClass(d)}`}
                >
                  {severityLabel(d)}
                </span>
              </div>
              <p className="text-sm text-[rgba(12,8,5,0.72)] leading-relaxed mb-4">
                {d.description}
              </p>
              {d.present && (d.remedies?.length > 0 || d.mitigation || d.remedyTemples) && (
                <div className="rounded-xl bg-[rgba(255,252,245,0.78)] border border-[rgba(12,8,5,0.08)] p-4 sm:p-5">
                  <Mitigation plan={d.mitigation} remedies={d.remedies} bare />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {data?.doshas && data.doshas.length > 0 && (
        <Interpretation
          domain="dosha"
          className="mt-4"
          input={{
            doshas: data.doshas.map((d) => ({
              name: d.name,
              present: d.present,
              severity: d.severity,
            })),
          }}
        />
      )}
      </div>
    </div>
  );
}
