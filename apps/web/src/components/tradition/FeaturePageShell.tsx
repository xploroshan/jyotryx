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

      {/* Feature hero — cream card with a soft sunrise wash. The per-
          tradition gradient (cfg.heroClass) sits behind a light overlay
          so it tints the card in the tradition's brand without ever
          breaking the cream-canvas contract. */}
      <section className="relative overflow-hidden rounded-3xl card-cream shadow-warm-md px-8 sm:px-10 py-10 mb-8">
        <div
          aria-hidden
          className="absolute inset-0 pointer-events-none opacity-25"
          style={{
            background:
              'radial-gradient(ellipse 80% 60% at 80% 0%, rgba(255,182,39,0.30) 0%, rgba(255,77,0,0.15) 40%, transparent 75%)',
          }}
        />
        <div
          aria-hidden
          className={`absolute inset-0 pointer-events-none opacity-15 bg-gradient-to-br ${cfg.heroClass}`}
        />
        <div className="relative flex items-center gap-5">
          <div className="shrink-0 grid place-items-center w-16 h-16 rounded-2xl bg-primary-500/15 border border-primary-500/35 text-primary-600 shadow-[0_0_28px_-6px_rgba(255,77,0,0.45)]">
            <span className="text-3xl leading-none" aria-hidden>
              {icon ?? cfg.icon}
            </span>
          </div>
          <div>
            <h1 className="font-display text-2xl sm:text-3xl font-semibold text-surface-950 tracking-tight">
              {featureName}
            </h1>
            {resolvedDescription && (
              <p className="mt-2 text-sm text-emphasis leading-relaxed">{resolvedDescription}</p>
            )}
          </div>
        </div>
      </section>

      {children}
    </PageTransition>
  );
}
