import { View, Text } from 'react-native';
import { useLocalSearchParams, Stack } from 'expo-router';
import { getTraditionBySlug, TRADITIONS, type TraditionId } from '@myastro360/shared';
import { resolveFeatureEndpoint } from '@/lib/feature-endpoints';
import { Screen, Heading, Muted, Card } from '@/components/ui';

/**
 * Generic feature screen (P2–P3 scaffold). Every feature in the registry is
 * navigable here and shows its VERIFIED endpoint contract + gate. Each real
 * feature (input form → request → result renderer) replaces this per its
 * milestone; until then this proves the route, the endpoint mapping, and the
 * tradition theming are all correct.
 */
export default function FeatureScreen() {
  const params = useLocalSearchParams<{ slug: string; tradition?: string }>();
  const slug = params.slug ?? '';
  const traditionId = (params.tradition as TraditionId) ?? 'VEDIC';
  const tradition = TRADITIONS[traditionId] ?? getTraditionBySlug('vedic');
  const endpoint = resolveFeatureEndpoint(traditionId, slug);
  const feature = tradition?.features.find((f) => f.slug === slug);

  const title = slug.replace(/-/g, ' ');

  return (
    <Screen>
      <Stack.Screen options={{ title: feature?.icon ? `${feature.icon} ${title}` : title }} />
      <Heading className="mt-4 capitalize">{title}</Heading>
      <Muted className="mt-1 mb-5 capitalize">{tradition?.slug} tradition</Muted>

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

      <Muted className="mt-5">
        Input form → request → result renderer is built in this feature's milestone (see plan §11).
      </Muted>
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
