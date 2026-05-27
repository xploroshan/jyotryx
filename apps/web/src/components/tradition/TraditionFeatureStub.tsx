'use client';

/**
 * Placeholder scaffold rendered by sub-route pages that don't yet
 * have full content (or want a compact landing). Same editorial
 * shell as FeaturePageShell so every sub-route inherits the
 * editorial-hero look automatically.
 */

import Link from 'next/link';
import { useTranslation } from '@/i18n';
import { WEB_TRADITIONS, type TraditionId } from '@/lib/traditions';
import { TraditionGlyph } from '@/components/icons';
import EditorialHero, { type EditorialTint } from '@/components/editorial/EditorialHero';

const TRADITION_TINT: Record<TraditionId, EditorialTint> = {
  VEDIC:       'amber',
  WESTERN:     'sky',
  CHINESE:     'red',
  HELLENISTIC: 'violet',
  HORARY:      'teal',
  MEDICAL:     'emerald',
};

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
  const description = descriptionKey ? readLabel(descriptionKey, '') : '';
  const tint = TRADITION_TINT[traditionId];

  return (
    <div>
      <EditorialHero
        tint={tint}
        eyebrow={`${traditionName} · ${featureName}`}
        eyebrowIcon={<TraditionGlyph id={traditionId} size={18} weight={1.4} />}
        headline={`{em}${featureName}{/em}`}
        tagline={description}
      />

      <div className="mx-auto max-w-4xl px-5 sm:px-8 py-8">
        <nav className="mb-5 text-xs text-secondary">
          <Link href={`/${cfg.slug}`} className="hover:text-surface-950 transition-colors">
            {traditionName}
          </Link>{' '}
          / <span className="text-emphasis">{featureName}</span>
        </nav>

        <div className="card-cream rounded-2xl p-6 shadow-warm-sm">
          {children ?? (
            <p className="text-sm text-secondary text-center py-6">
              {readLabel('traditionsUi.comingSoon', 'Coming soon')}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
