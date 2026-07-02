import { View, Text } from 'react-native';
import { Card, Muted } from '@/components/ui';
import { Section, KV } from './common';
import type { HoraryData } from './responses.p3';

export function HoraryResult({ data }: { data: HoraryData }) {
  return (
    <View>
      <Card className="mb-4">
        <Text className="text-fg font-semibold mb-1">{data.question}</Text>
        <Muted className="text-xs">{data.askedAt?.slice(0, 16).replace('T', ' ')}</Muted>
      </Card>
      <Card className="mb-4">
        <Section title="Chart">
          <KV label="Ascendant" value={`${data.chart?.ascendant?.sign} · ${Math.round(data.chart?.ascendant?.degree ?? 0)}°`} />
          <KV label="Querent" value={data.chart?.significators?.querent} />
          <KV label="Quesited" value={data.chart?.significators?.quesited} />
          <KV label="Moon" value={data.chart?.significators?.moon} />
        </Section>
      </Card>
      <Card>
        <Text className="text-accent text-xs font-semibold mb-1">Judgment</Text>
        <Text className="text-fg-muted leading-6">{data.judgment}</Text>
      </Card>
    </View>
  );
}
