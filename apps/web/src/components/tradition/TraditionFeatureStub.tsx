'use client';

import Link from 'next/link';
import { useTranslation } from '@/i18n';
import { WEB_TRADITIONS, type TraditionId } from '@/lib/traditions';
import { PageTransition } from '@/components/ui/PageTransition';

/**
 * Placeholder scaffold rendered by each new tradition-feature page until
 * the backend endpoint and full form are wired up.
 *
 * Uses the tradition's palette so the page doesn't feel empty — users
 * land on the correct tradition-branded skeleton and can navigate back
 * to the tradition dashboard.
 */
export default function TraditionFeatureStub({
  traditionId,
  featureKey,
  descriptionKey,
  children,
}: {
  traditionId: TraditionId;
  featureKey: string; // e.g. 'traditionsUi.chinese.features.bazi'
  descriptionKey?: string;
  children?: React.ReactNode;
}) {
  const { t } = useTranslation();
  const cfg = WEB_TRADITIONS[traditionId];

  const readLabel = (path: string, fallback = path): string => {
    const parts = path.split('.');
    let node: any = t;
    for (const part of parts) {
      if (node && typeof node === 'object' && part in node) node = node[part];
      else return fallback;
    }
    return typeof node === 'string' ? node : fallback;
  };

  const traditionName = readLabel(cfg.labelKey, cfg.slug);
  const featureName = readLabel(featureKey, featureKey);

  return (
    <PageTransition className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-8 pt-20">
      <nav className="mb-4 text-xs text-secondary">
        <Link href={`/${cfg.slug}`} className="hover:text-surface-950 transition-colors">
          {traditionName}
        </Link>{' '}
        / <span className="text-emphasis">{featureName}</span>
      </nav>

      {/* Tradition-coloured deep ink island for the page header — keeps
          the per-tradition gradient (heroClass) without competing with
          the cream canvas. */}
      <section
        className={`relative overflow-hidden rounded-3xl bg-surface-950 border border-white/[0.06] shadow-warm-md px-6 sm:px-10 py-8 mb-6`}
      >
        <div
          aria-hidden
          className={`absolute inset-0 bg-gradient-to-br ${cfg.heroClass} opacity-90`}
        />
        <div className="relative flex items-center gap-4">
          <span className="text-4xl leading-none" aria-hidden>
            {cfg.icon}
          </span>
          <div>
            <h1 className="font-display text-xl sm:text-2xl font-semibold text-surface-50 tracking-tight">
              {featureName}
            </h1>
            {descriptionKey && (
              <p className="mt-1 text-sm text-surface-50/70">
                {readLabel(descriptionKey, '')}
              </p>
            )}
          </div>
        </div>
      </section>

      {/* Children container kept as dark-canvas surface-card so each
          tradition's stub content (forms, result tiles styled with
          text-surface-50 + bg-white/[0.04]) reads correctly on the
          deep ink island this page renders inside. */}
      <div className="relative rounded-2xl bg-surface-950 border border-white/[0.06] shadow-warm-md p-6 overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'radial-gradient(ellipse 70% 60% at 50% -10%, rgba(255,182,39,0.08) 0%, transparent 70%)',
          }}
        />
        <div className="relative">
          {children ?? (
            <p className="text-sm text-surface-50/60 text-center py-6">
              {readLabel('traditionsUi.comingSoon', 'Coming soon')}
            </p>
          )}
        </div>
      </div>
    </PageTransition>
  );
}
