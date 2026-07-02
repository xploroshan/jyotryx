import { useState } from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { useAuthStore } from '@/store/auth';
import { Screen, Heading, Muted, Card, Button } from '@/components/ui';
import { loadHoraryHistory, deleteHoraryRecord, clearHoraryHistory, type HoraryRecord } from './horary-history';

/**
 * Horary history — a fully client-side screen (no API). Reads the MMKV-backed
 * records saved after each horary ask, newest-first, with per-record delete and
 * clear-all. Mirrors the web history page.
 */
export function HoraryHistoryScreen() {
  const userId = useAuthStore((s) => s.user?.id);
  const [records, setRecords] = useState<HoraryRecord[]>(() => loadHoraryHistory(userId));

  const remove = (id: string) => {
    deleteHoraryRecord(userId, id);
    setRecords(loadHoraryHistory(userId));
  };
  const clearAll = () => {
    clearHoraryHistory(userId);
    setRecords([]);
  };

  return (
    <Screen>
      <View className="flex-row items-center justify-between mt-4 mb-4">
        <Heading>Horary history</Heading>
        {records.length > 0 ? (
          <Pressable testID="horary-clear" onPress={clearAll}>
            <Text className="text-danger text-xs">Clear all</Text>
          </Pressable>
        ) : null}
      </View>

      {records.length === 0 ? (
        <Card>
          <Muted>No questions yet. Ask a horary question and it'll be saved here on your device.</Muted>
        </Card>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
          {records.map((r) => (
            <Card key={r.id} className="mb-3" testID="horary-record">
              <View className="flex-row justify-between items-start">
                <Text className="text-fg font-medium flex-1 mr-2">{r.question}</Text>
                <Pressable onPress={() => remove(r.id)}>
                  <Text className="text-fg-subtle text-xs">Delete</Text>
                </Pressable>
              </View>
              <Muted className="text-[11px] mt-0.5">{r.askedAt?.slice(0, 16).replace('T', ' ')}</Muted>
              <Text className="text-fg-muted text-sm mt-2" numberOfLines={3}>
                {r.judgment}
              </Text>
            </Card>
          ))}
        </ScrollView>
      )}
    </Screen>
  );
}
