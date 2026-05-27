/**
 * Thin wrapper around EditorialHero with feature-page defaults.
 *
 * The 8 form-driven features (/kundli, /panchang, /muhurat, …) and
 * the ~15 sub-route pages (/vedic/dasha, /western/natal, …) all
 * open with the same editorial dark band. Each picks its own tint
 * and headline; everything else (form, results, content) lives in
 * its own page body underneath.
 *
 * Usage:
 *   <FeatureHeader
 *     tint="amber"
 *     eyebrow="Kundli"
 *     headline="Your full {em}Vedic chart{/em}"
 *     tagline="Birth details, planetary positions, dasha periods, doshas."
 *   />
 */

import EditorialHero, { type EditorialTint, type EditorialHeroProps } from './EditorialHero';

export type FeatureHeaderProps = Omit<EditorialHeroProps, 'tint' | 'eyebrowIcon'> & {
  tint?: EditorialTint;
  eyebrowIcon?: EditorialHeroProps['eyebrowIcon'];
};

export default function FeatureHeader({ tint = 'indigo', ...rest }: FeatureHeaderProps) {
  return <EditorialHero tint={tint} {...rest} />;
}
