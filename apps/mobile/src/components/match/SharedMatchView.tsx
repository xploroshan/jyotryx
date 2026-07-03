import { View, Text } from 'react-native';
import { Card, Muted } from '@/components/ui';
import { Section, KV, ScoreBar } from '@/features/results/common';
import type { SharedMatchPayload } from '@/features/results/responses.p4';

/** Read-only shared compatibility view (mirrors the web /match/[token] page). */
export function SharedMatchView({ data }: { data: SharedMatchPayload }) {
  return (
    <View>
      <View className="items-center mb-4">
        <Text className="text-2xl">💞</Text>
        <Text className="text-fg text-lg font-semibold text-center">
          {data.personAName} &amp; {data.personBName}
        </Text>
      </View>

      <Card className="mb-4">
        <ScoreBar score={data.percentage} label="Compatibility" />
        <Text className="text-fg-muted text-xs mt-1">
          {data.totalScore}/{data.maxScore} gunas · {data.compatibility}
        </Text>
        <View className="flex-row gap-4 mt-2">
          <Text className="text-xs text-fg-subtle">Manglik — A: {data.manglikA ? 'Yes' : 'No'}</Text>
          <Text className="text-xs text-fg-subtle">B: {data.manglikB ? 'Yes' : 'No'}</Text>
        </View>
      </Card>

      <Card className="mb-4">
        <Section title="Ashtakoota">
          {data.gunaDetails?.map((g, i) => (
            <KV key={i} label={g.guna} value={`${g.obtainedPoints}/${g.maxPoints}`} />
          ))}
        </Section>
      </Card>

      {data.recommendation ? (
        <Card>
          <Muted>{data.recommendation}</Muted>
        </Card>
      ) : null}
    </View>
  );
}
