'use client';

import Link from 'next/link';
import { ReactNode } from 'react';
import { useTranslation } from '@/i18n';
import { WEB_TRADITIONS, type TraditionId } from '@/lib/traditions';

/**
 * Shared layout for tradition-feature pages. Gives every feature the
 * same breadcrumb + glass hero + content area so the individual pages
 * can focus purely on data fetching and domain rendering.
 *
 * Compose like:
 *   <FeaturePageShell traditionId="WESTERN" featureKey="traditionsUi.western.features.transits" icon="🌠">
 *     ...page-specific body...
 *   </FeaturePageShell>
 */
export default function FeaturePageShell({
  traditionId,
  featureKey,
  icon,
  description,
  children,
}: {
  traditionId: TraditionId;
  featureKey: string;
  icon?: string;
  description?: string;
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
            {icon ?? cfg.icon}
          </span>
          <div>
            <h1 className="text-xl sm:text-2xl font-semibold text-white tracking-tight">
              {featureName}
            </h1>
            {description && (
              <p className="mt-1 text-sm text-white/70">{description}</p>
            )}
          </div>
        </div>
      </section>

      {children}
    </div>
  );
}
