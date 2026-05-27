'use client';

/**
 * Shared sub-route shell for tradition feature pages. Renders the
 * editorial dark hero band on top of every sub-route (e.g.
 * /western/transits, /horary/history) so they look like members of
 * the same editorial system as the tradition landings.
 *
 * The 7 pages currently using this component:
 *   /western/transits, /western/synastry, /chinese/flying-stars,
 *   /hellenistic/natal, /hellenistic/zodiacal-releasing,
 *   /horary/history, /medical/decumbiture
 *
 * Sibling TraditionFeatureStub uses the same editorial hero so all
 * sub-routes share the look.
 */

import Link from 'next/link';
import { ReactNode } from 'react';
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

export default function FeaturePageShell({
  traditionId,
  featureKey,
  icon: _icon,
  description,
  descriptionKey,
  children,
}: {
  traditionId: TraditionId;
  featureKey: string;
  /** Legacy emoji icon — kept in the signature so existing callers
   *  don't break; we now render the canonical TraditionGlyph
   *  inside the editorial hero instead. */
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
  const tint = TRADITION_TINT[traditionId];

  return (
    <div>
      <EditorialHero
        tint={tint}
        eyebrow={`${traditionName} · ${featureName}`}
        eyebrowIcon={<TraditionGlyph id={traditionId} size={18} weight={1.4} />}
        headline={`{em}${featureName}{/em}`}
        tagline={resolvedDescription}
      />

      <div className="mx-auto max-w-4xl px-5 sm:px-8 py-8">
        <nav className="mb-5 text-sm text-secondary">
          <Link href={`/${cfg.slug}`} className="hover:text-surface-950 transition-colors">
            {traditionName}
          </Link>{' '}
          <span style={{ color: 'rgba(12,8,5,0.30)' }}>/</span>{' '}
          <span className="text-emphasis">{featureName}</span>
        </nav>

        {children}
      </div>
    </div>
  );
}
