import { ScrollView } from 'react-native';
import { useLocalSearchParams, Stack } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { endpoints } from '@myastro360/shared';
import { api } from '@/api/client';
import { Screen, Heading, Muted, Card, Button } from '@/components/ui';
import { SharedMatchView } from '@/components/match/SharedMatchView';
import { useRouter } from 'expo-router';
import type { SharedMatchPayload } from '@/features/results/responses.p4';

/**
 * Public shared-match view — reached via a `myastro360.com/match/:token`
 * universal link or `myastro360://match/:token`. The endpoint is public, so no
 * auth is required (the shared api client just omits the bearer if absent).
 */
export default function SharedMatchScreen() {
  const router = useRouter();
  const { token } = useLocalSearchParams<{ token: string }>();

  const q = useQuery({
    queryKey: ['shared-match', token],
    queryFn: () => api.get<SharedMatchPayload>(endpoints.astrology.matchingShared(token ?? '')),
    enabled: !!token,
    retry: false,
  });

  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: 'Compatibility' }} />
      <Screen>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingVertical: 16 }}>
          {q.isLoading ? (
            <Muted className="mt-8">Loading…</Muted>
          ) : q.isError || !q.data ? (
            <Card className="mt-6">
              <Heading className="mb-2">Not found</Heading>
              <Muted className="mb-4">This shared result is unavailable or has expired.</Muted>
              <Button title="Explore MyAstro360" onPress={() => router.replace('/(tabs)')} />
            </Card>
          ) : (
            <>
              <SharedMatchView data={q.data} />
              <Card className="mt-4">
                <Muted className="mb-3">Want your own compatibility reading?</Muted>
                <Button
                  title="Try Matching"
                  onPress={() => router.push({ pathname: '/feature/[slug]', params: { slug: 'matching', tradition: 'VEDIC' } })}
                />
              </Card>
            </>
          )}
        </ScrollView>
      </Screen>
    </>
  );
}
