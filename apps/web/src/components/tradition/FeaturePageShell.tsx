'use client';

import Link from 'next/link';
import { ReactNode } from 'react';
import { useTranslation } from '@/i18n';
import { WEB_TRADITIONS, type TraditionId } from '@/lib/traditions';
import { PageTransition } from '@/components/ui/PageTransition';

export default function FeaturePageShell({
  traditionId,
  featureKey,
  icon,
  description,
  descriptionKey,
  children,
}: {
  traditionId: TraditionId;
  featureKey: string;
  icon?: string;
  description?: string;
  descriptionKey?: string;
  children: ReactNode;
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
  const resolvedDescription = descriptionKey
    ? readLabel(descriptionKey, description ?? '')
    : description;

  return (
    <PageTransition className="mx-auto max-w-4xl px-5 sm:px-8 py-8 pt-4">
      <nav className="mb-5 text-sm text-secondary">
        <Link href={`/${cfg.slug}`} className="hover:text-surface-950 transition-colors">
          {traditionName}
        </Link>{' '}
        <span style={{ color: 'rgba(12,8,5,0.30)' }}>/</span>{' '}
        <span className="text-emphasis">{featureName}</span>
      </nav>

      {/* Feature hero — sits on the cream canvas as a deep ink block so
          the per-tradition gradient (heroClass, e.g. from-vedic-500/...)
          still reads as a confident editorial header without competing
          with the page-wide cream. White text in here is intentional —
          this is a dark island on a light page. */}
      <section
        className={`relative rounded-3xl overflow-hidden bg-surface-950 border border-white/[0.06] px-8 sm:px-10 py-10 mb-8 shadow-warm-md`}
      >
        <div
          aria-hidden
          className={`absolute inset-0 bg-gradient-to-br ${cfg.heroClass} opacity-90`}
        />
        <div className="relative flex items-center gap-5">
          <span className="text-4xl leading-none" aria-hidden>
            {icon ?? cfg.icon}
          </span>
          <div>
            <h1 className="font-display text-2xl sm:text-3xl font-bold text-surface-50 tracking-tight">
              {featureName}
            </h1>
            {resolvedDescription && (
              <p className="mt-2 text-sm text-surface-50/65 leading-relaxed">{resolvedDescription}</p>
            )}
          </div>
        </div>
      </section>

      {children}
    </PageTransition>
  );
}
