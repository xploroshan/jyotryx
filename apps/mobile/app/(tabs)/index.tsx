import { ScrollView, View, Text, RefreshControl } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { endpoints, type DailyBriefing } from '@myastro360/shared';
import { api } from '@/api/client';
import { useAuthStore } from '@/store/auth';
import { Screen, Heading, Muted, Card, Button } from '@/components/ui';

/**
 * My Day — the cross-tradition daily briefing. Real fetch against
 * GET /daily-briefing (verified endpoint), cached + offline-readable via the
 * MMKV-persisted query client. This is the vertical slice that proves the
 * shared-client → store → TanStack Query wiring end-to-end.
 */
export default function MyDay() {
  const user = useAuthStore((s) => s.user);

  const { data, isLoading, isError, refetch, isRefetching } = useQuery({
    queryKey: ['daily-briefing'],
    queryFn: () => api.get<DailyBriefing>(endpoints.dailyBriefing.base),
  });

  return (
    <Screen>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingVertical: 20 }}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
      >
        <Muted>{greeting()}</Muted>
        <Heading className="mb-4">{user?.nickname || user?.name || 'Seeker'}</Heading>

        <Card testID="myday-card">
          <Text className="text-fg font-semibold mb-2">Today's briefing</Text>
          {isLoading ? (
            <Muted>Reading the sky…</Muted>
          ) : isError ? (
            <View>
              <Muted className="mb-3">Couldn't load your briefing. Check your connection.</Muted>
              <Button title="Retry" variant="secondary" onPress={() => refetch()} />
            </View>
          ) : (
            <Text className="text-fg-muted leading-6" testID="myday-summary">
              {data?.summary ?? 'Your personalised briefing will appear here.'}
            </Text>
          )}
        </Card>

        <View className="flex-row items-center justify-between mt-6 mb-2">
          <Text className="text-fg font-semibold">Credits</Text>
          <Text className="text-accent font-bold" testID="myday-credits">
            {user?.credits ?? 0}
          </Text>
        </View>
      </ScrollView>
    </Screen>
  );
}

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}
