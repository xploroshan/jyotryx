'use client';

import Link from 'next/link';
import { useTranslation } from '@/i18n';
import { WEB_TRADITIONS, type TraditionId } from '@/lib/traditions';

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
    <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-8 pt-20">
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
            {cfg.icon}
          </span>
          <div>
            <h1 className="text-xl sm:text-2xl font-semibold text-white tracking-tight">
              {featureName}
            </h1>
            {descriptionKey && (
              <p className="mt-1 text-sm text-white/70">
                {readLabel(descriptionKey, '')}
              </p>
            )}
          </div>
        </div>
      </section>

      <div className="surface-card rounded-2xl p-6">
        {children ?? (
          <p className="text-sm text-white/60 text-center py-6">
            {readLabel('traditionsUi.comingSoon', 'Coming soon')}
          </p>
        )}
      </div>
    </div>
  );
}
