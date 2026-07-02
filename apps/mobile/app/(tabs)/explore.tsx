import { useMemo } from 'react';
import { ScrollView, View, Text, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import {
  TRADITION_LIST,
  TRADITIONS,
  resolveActiveTradition,
  type TraditionId,
} from '@myastro360/shared';
import { useAuthStore } from '@/store/auth';
import { Screen, Heading, Muted } from '@/components/ui';

/**
 * Explore — the persistent tradition rail + the active tradition's feature
 * grid. Both are generated from the shared registry (single source of truth),
 * so all 6 traditions and their features are navigable. Tapping a feature
 * pushes the generic feature screen, which maps the slug to its verified
 * endpoint.
 */
export default function Explore() {
  const router = useRouter();
  const { user, activeTradition, setActiveTradition } = useAuthStore();

  const active: TraditionId = useMemo(
    () =>
      (activeTradition as TraditionId) ??
      resolveActiveTradition({
        primaryTradition: user?.primaryTradition,
        astrologyTraditions: user?.astrologyTraditions,
      }),
    [activeTradition, user],
  );

  const tradition = TRADITIONS[active];

  return (
    <Screen>
      <Heading className="mt-4 mb-3">Explore</Heading>

      {/* Tradition rail */}
      <View className="mb-4">
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View className="flex-row gap-2">
            {TRADITION_LIST.map((t) => {
              const on = t.id === active;
              return (
                <Pressable
                  key={t.id}
                  testID={`rail-${t.slug}`}
                  onPress={() => setActiveTradition(t.id)}
                  className={`px-4 py-2 rounded-full border ${
                    on ? 'border-accent' : 'border-border'
                  }`}
                  style={on ? { backgroundColor: t.accentHex + '22' } : undefined}
                >
                  <Text className={on ? 'text-fg font-semibold' : 'text-fg-muted'}>
                    {t.icon} {t.slug}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </ScrollView>
      </View>

      <Pressable
        testID={`open-dashboard-${tradition.slug}`}
        onPress={() => router.push({ pathname: '/tradition/[slug]', params: { slug: tradition.slug } })}
      >
        <Muted className="mb-3">Open the {tradition.slug} dashboard →</Muted>
      </Pressable>

      {/* Feature grid for the active tradition */}
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
        <View className="flex-row flex-wrap justify-between">
          {tradition.features.map((f) => (
            <Pressable
              key={f.slug}
              testID={`feature-${f.slug}`}
              onPress={() =>
                router.push({ pathname: '/feature/[slug]', params: { slug: f.slug, tradition: active } })
              }
              className="w-[48%] mb-3 rounded-2xl bg-surface border border-border p-4"
            >
              <Text className="text-2xl mb-2">{f.icon ?? '✨'}</Text>
              <Text className="text-fg font-medium capitalize">{f.slug.replace(/-/g, ' ')}</Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </Screen>
  );
}
