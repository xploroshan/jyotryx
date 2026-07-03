import { View, Text } from 'react-native';
import { TRADITIONS, type TraditionId } from '@myastro360/shared';
import { resolveFeatureEndpoint } from '@/lib/feature-endpoints';
import { Screen, Heading, Muted, Card } from '@/components/ui';

/**
 * Fallback for features without a built runner yet (the other 5 traditions,
 * P3+). Shows the verified endpoint contract so the route + mapping are visible.
 */
export function FeatureContract({ slug, tradition }: { slug: string; tradition: TraditionId }) {
  const config = TRADITIONS[tradition];
  const endpoint = resolveFeatureEndpoint(tradition, slug);
  const feature = config?.features.find((f) => f.slug === slug);
  const title = slug.replace(/-/g, ' ');

  return (
    <Screen>
      <Heading className="mt-4 capitalize">{feature?.icon ? `${feature.icon} ${title}` : title}</Heading>
      <Muted className="mt-1 mb-5 capitalize">{config?.slug} tradition</Muted>

      <Card testID="feature-contract">
        <Text className="text-fg font-semibold mb-2">Endpoint contract</Text>
        {endpoint ? (
          <View className="gap-1">
            <Row label="Method" value={endpoint.method} />
            <Row label="Path" value={endpoint.path} />
            <Row label="Gate" value={endpoint.gate} />
            {endpoint.note ? <Row label="Note" value={endpoint.note} /> : null}
          </View>
        ) : (
          <Muted>No endpoint mapped for this feature.</Muted>
        )}
      </Card>

      <Muted className="mt-5">This feature's screen is built in a later milestone (see plan §11).</Muted>
    </Screen>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row justify-between">
      <Text className="text-fg-subtle text-xs">{label}</Text>
      <Text className="text-fg text-xs font-medium flex-1 text-right ml-4" numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}
