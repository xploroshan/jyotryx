import { useState } from 'react';
import { View, Text } from 'react-native';
import { useQuery, useMutation } from '@tanstack/react-query';
import { ApiError, endpoints } from '@myastro360/shared';
import { api } from '@/api/client';
import { useAuthStore } from '@/store/auth';
import { useI18nStore } from '@/store/i18n';
import { Card, Button, Muted } from '@/components/ui';
import { Section, Bullets } from './results/common';

interface InterpretationData {
  summary: string;
  points: string[];
  guidance: string;
  disclaimer?: string;
  sections?: { title: string; body: string }[];
  depth?: 'teaser' | 'deep';
}

/**
 * "What this means" — the shared interpretation block (all features render it on
 * web). Fires a free teaser (POST /interpretation) automatically, then offers a
 * paid deep-dive (POST /interpretation/deep-dive). A 402 = insufficient credits.
 */
export function InterpretationPanel({ domain, payload }: { domain: string; payload: Record<string, unknown> }) {
  const locale = useI18nStore((s) => s.locale);
  const isAuthed = useAuthStore((s) => s.isAuthenticated);
  const [deep, setDeep] = useState<InterpretationData | null>(null);
  const [needCredits, setNeedCredits] = useState(false);

  const teaser = useQuery({
    queryKey: ['interpretation', domain, payload],
    queryFn: () => api.post<InterpretationData>(endpoints.interpretation.base, { domain, payload, locale }),
    retry: false,
    staleTime: 60_000,
  });

  const deepDive = useMutation({
    mutationFn: () => api.post<InterpretationData>(endpoints.interpretation.deepDive, { domain, payload, locale }),
    onSuccess: (d) => {
      setDeep(d);
      setNeedCredits(false);
    },
    onError: (e) => {
      if (e instanceof ApiError && e.status === 402) setNeedCredits(true);
    },
  });

  const shown = deep ?? teaser.data;
  if (teaser.isLoading) {
    return (
      <Card>
        <Muted>Interpreting…</Muted>
      </Card>
    );
  }
  if (!shown) return null;

  return (
    <Card testID="interpretation">
      <Text className="text-fg font-semibold mb-2">What this means</Text>
      {shown.summary ? <Text className="text-fg-muted text-sm mb-3">{shown.summary}</Text> : null}
      <Bullets items={shown.points} />
      {shown.guidance ? <Text className="text-fg-muted text-sm mt-3">{shown.guidance}</Text> : null}

      {shown.sections?.map((s: { title: string; body: string }, i: number) => (
        <View key={i} className="mt-3">
          <Section title={s.title}>
            <Text className="text-fg-muted text-sm">{s.body}</Text>
          </Section>
        </View>
      ))}

      {shown.depth !== 'deep' && !deep ? (
        <View className="mt-4">
          {needCredits ? (
            <Muted className="mb-2">A deeper reading needs credits (add them in the payments update).</Muted>
          ) : null}
          <Button
            testID="deep-dive"
            title={deepDive.isPending ? 'Reading…' : 'Go deeper'}
            loading={deepDive.isPending}
            variant="secondary"
            onPress={() => (isAuthed ? deepDive.mutate() : undefined)}
          />
        </View>
      ) : null}

      {shown.disclaimer ? <Muted className="mt-3 text-[11px]">{shown.disclaimer}</Muted> : null}
    </Card>
  );
}
