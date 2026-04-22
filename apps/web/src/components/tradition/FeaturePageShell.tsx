'use client';

import Link from 'next/link';
import { ReactNode } from 'react';
import { useTranslation } from '@/i18n';
import { WEB_TRADITIONS, type TraditionId } from '@/lib/traditions';

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
    <div className="mx-auto max-w-4xl px-5 sm:px-8 py-8 pt-4 fade-in-up">
      <nav className="mb-5 text-sm text-white/40">
        <Link href={`/${cfg.slug}`} className="hover:text-white transition-colors">
          {traditionName}
        </Link>{' '}
        <span className="text-white/20">/</span>{' '}
        <span className="text-white/60">{featureName}</span>
      </nav>

      <section
        className={`rounded-3xl bg-gradient-to-br ${cfg.heroClass} border border-white/[0.06] px-8 sm:px-10 py-10 mb-8`}
      >
        <div className="flex items-center gap-5">
          <span className="text-4xl leading-none" aria-hidden>
            {icon ?? cfg.icon}
          </span>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
              {featureName}
            </h1>
            {resolvedDescription && (
              <p className="mt-2 text-sm text-white/50 leading-relaxed">{resolvedDescription}</p>
            )}
          </div>
        </div>
      </section>

      {children}
    </div>
  );
}
