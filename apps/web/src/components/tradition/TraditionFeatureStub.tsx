'use client';

import Link from 'next/link';
import { useTranslation } from '@/i18n';
import { WEB_TRADITIONS, type TraditionId } from '@/lib/traditions';
import { PageTransition } from '@/components/ui/PageTransition';

/**
 * Placeholder scaffold rendered by each new tradition-feature page until
 * the backend endpoint and full form are wired up.
 *
 * Lives on the cream canvas: per-tradition palette is hinted via a low-
 * opacity overlay rather than a saturated dark band, so every tradition's
 * stub looks like a member of the same editorial system.
 */
export default function TraditionFeatureStub({
  traditionId,
  featureKey,
  descriptionKey,
  children,
}: {
  traditionId: TraditionId;
  featureKey: string;
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

      <section className="relative overflow-hidden rounded-3xl card-cream shadow-warm-md px-6 sm:px-10 py-8 mb-6">
        <div
          aria-hidden
          className={`absolute inset-0 pointer-events-none bg-gradient-to-br ${cfg.heroClass}`}
          style={{ opacity: 0.10 }}
        />
        <div
          aria-hidden
          className="absolute inset-0 pointer-events-none opacity-25"
          style={{
            background:
              'radial-gradient(ellipse 80% 60% at 80% 0%, rgba(255,182,39,0.30) 0%, rgba(255,77,0,0.15) 40%, transparent 75%)',
          }}
        />
        <div className="relative flex items-center gap-4">
          <div className="shrink-0 grid place-items-center w-14 h-14 rounded-xl bg-primary-500/15 border border-primary-500/30 text-primary-600">
            <span className="text-3xl leading-none" aria-hidden>
              {cfg.icon}
            </span>
          </div>
          <div>
            <h1 className="font-display text-xl sm:text-2xl font-semibold text-surface-950 tracking-tight">
              {featureName}
            </h1>
            {descriptionKey && (
              <p className="mt-1 text-sm text-emphasis">
                {readLabel(descriptionKey, '')}
              </p>
            )}
          </div>
        </div>
      </section>

      <div className="card-cream rounded-2xl p-6 shadow-warm-sm">
        {children ?? (
          <p className="text-sm text-secondary text-center py-6">
            {readLabel('traditionsUi.comingSoon', 'Coming soon')}
          </p>
        )}
      </div>
    </PageTransition>
  );
}
