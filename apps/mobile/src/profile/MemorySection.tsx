import { useState } from 'react';
import { View, Text, TextInput, Pressable } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { endpoints } from '@myastro360/shared';
import { api } from '@/api/client';
import { useAuthStore } from '@/store/auth';
import { Card, Muted, Button } from '@/components/ui';
import type { Memory, MemoryKind } from '@/features/results/responses.p4';

const KINDS: MemoryKind[] = ['fact', 'preference', 'goal', 'event'];

/**
 * Personalization memory — the mobile mirror of the web Profile MemorySection.
 * The astrologer chat folds these into its system prompt server-side; here the
 * user manages them via /memory CRUD.
 */
export function MemorySection() {
  const qc = useQueryClient();
  const isAuthed = useAuthStore((s) => s.isAuthenticated);
  const [content, setContent] = useState('');
  const [kind, setKind] = useState<MemoryKind>('fact');

  const list = useQuery({
    queryKey: ['memory'],
    queryFn: () => api.get<Memory[]>(endpoints.memory.list),
    enabled: isAuthed,
  });

  const add = useMutation({
    mutationFn: () => api.post<Memory>(endpoints.memory.create, { content: content.trim(), kind }),
    onSuccess: () => {
      setContent('');
      qc.invalidateQueries({ queryKey: ['memory'] });
    },
  });

  const del = useMutation({
    mutationFn: (id: string) => api.delete<{ deleted: boolean }>(endpoints.memory.remove(id)),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['memory'] }),
  });

  const memories: Memory[] = list.data ?? [];

  return (
    <Card testID="memory-section">
      <Text className="text-fg font-semibold mb-1">Personalization</Text>
      <Muted className="mb-3">Facts your astrologer should remember about you.</Muted>

      <View className="flex-row flex-wrap gap-1.5 mb-2">
        {KINDS.map((k) => (
          <Pressable
            key={k}
            testID={`memory-kind-${k}`}
            onPress={() => setKind(k)}
            className={`px-2.5 py-1 rounded-full border ${kind === k ? 'bg-accent-subtle border-accent' : 'bg-surface border-border'}`}
          >
            <Text className={`text-xs capitalize ${kind === k ? 'text-accent' : 'text-fg-muted'}`}>{k}</Text>
          </Pressable>
        ))}
      </View>
      <TextInput
        testID="memory-input"
        value={content}
        onChangeText={setContent}
        placeholder="e.g. I'm a Taurus, works in tech"
        placeholderTextColor="#807666"
        maxLength={500}
        className="h-11 rounded-lg border border-border bg-bg px-3 text-fg mb-2"
      />
      <Button
        testID="memory-add"
        title={add.isPending ? 'Saving…' : 'Add memory'}
        loading={add.isPending}
        disabled={!content.trim()}
        onPress={() => add.mutate()}
      />

      <View className="mt-4 gap-2">
        {list.isLoading ? (
          <Muted>Loading…</Muted>
        ) : memories.length === 0 ? (
          <Muted>No memories yet.</Muted>
        ) : (
          memories.map((m) => (
            <View key={m.id} testID="memory-item" className="flex-row items-start justify-between border-b border-border/50 pb-2">
              <View className="flex-1 mr-2">
                <Text className="text-accent text-[11px] uppercase">{m.kind}</Text>
                <Text className="text-fg-muted text-sm">{m.content}</Text>
              </View>
              <Pressable onPress={() => del.mutate(m.id)}>
                <Text className="text-fg-subtle text-xs">Remove</Text>
              </Pressable>
            </View>
          ))
        )}
      </View>
    </Card>
  );
}
