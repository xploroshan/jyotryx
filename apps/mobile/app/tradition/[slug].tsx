import { ScrollView, View, Text, Pressable } from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { getTraditionBySlug } from '@myastro360/shared';
import { Screen, Heading, Muted, Card } from '@/components/ui';

/**
 * Per-tradition dashboard — accent-themed hero + the tradition's feature chips,
 * generated from the shared registry (mirrors web's TraditionDashboard). One
 * screen serves all 6 traditions.
 */
export default function TraditionDashboard() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const router = useRouter();
  const tradition = getTraditionBySlug(slug ?? '');

  if (!tradition) {
    return (
      <Screen>
        <Muted className="mt-8">Unknown tradition.</Muted>
      </Screen>
    );
  }

  return (
    <Screen>
      <Stack.Screen options={{ title: `${tradition.icon} ${tradition.slug}` }} />
      <View
        className="rounded-2xl p-5 mb-5 mt-2 border border-border"
        style={{ backgroundColor: tradition.accentHex + '18' }}
      >
        <Text className="text-4xl mb-1">{tradition.icon}</Text>
        <Heading className="capitalize">{tradition.slug}</Heading>
        <Muted className="mt-1">{tradition.features.length} features</Muted>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
        {tradition.features.map((f) => (
          <Pressable
            key={f.slug}
            testID={`dashboard-feature-${f.slug}`}
            onPress={() =>
              router.push({
                pathname: '/feature/[slug]',
                params: { slug: f.slug, tradition: tradition.id },
              })
            }
          >
            <Card className="mb-2 flex-row items-center">
              <Text className="text-2xl mr-3">{f.icon ?? '✨'}</Text>
              <Text className="text-fg font-medium capitalize flex-1">{f.slug.replace(/-/g, ' ')}</Text>
              <Text className="text-fg-subtle">›</Text>
            </Card>
          </Pressable>
        ))}
      </ScrollView>
    </Screen>
  );
}
