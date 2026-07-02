import { useLocalSearchParams, Stack } from 'expo-router';
import { TRADITIONS, type TraditionId } from '@myastro360/shared';
import { FeatureRunner } from '@/features/FeatureRunner';
import { getFeature } from '@/features';

/**
 * Feature route. Renders the full spec-driven runner (input → request → result
 * + interpretation) for built Vedic features; other traditions fall back to the
 * endpoint-contract view inside FeatureRunner.
 */
export default function FeatureScreen() {
  const params = useLocalSearchParams<{ slug: string; tradition?: string }>();
  const slug = params.slug ?? '';
  const tradition = (params.tradition as TraditionId) ?? 'VEDIC';
  const feature = getFeature(tradition, slug);
  const icon = TRADITIONS[tradition]?.features.find((f) => f.slug === slug)?.icon;
  const title = feature?.title ?? slug.replace(/-/g, ' ');

  return (
    <>
      <Stack.Screen options={{ title: icon ? `${icon} ${title}` : title }} />
      <FeatureRunner slug={slug} tradition={tradition} />
    </>
  );
}
