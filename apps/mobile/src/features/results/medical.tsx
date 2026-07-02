import { View, Text } from 'react-native';
import { Card, Muted } from '@/components/ui';
import { Section, KV, Chips } from './common';
import type { DecumbitureData, BodyZodiacData } from './responses.p3';

export function DecumbitureResult({ data }: { data: DecumbitureData }) {
  return (
    <View>
      <Card className="mb-4">
        <Section title={`Decumbiture · ${data.decumbitureAt?.slice(0, 16).replace('T', ' ') ?? ''}`}>
          <KV label="Ascendant" value={`${data.ascendant?.sign} · ${data.ascendantElement}`} />
          <KV label="6th house" value={data.sixthHouseSign} />
          {data.moon ? <KV label="Moon" value={data.moon.sign} /> : null}
          {data.symptoms ? <KV label="Symptoms" value={data.symptoms} /> : null}
        </Section>
      </Card>
      {data.guidance ? (
        <Card className="mb-4">
          <Text className="text-accent text-xs font-semibold mb-1">Guidance</Text>
          <Muted>{data.guidance}</Muted>
        </Card>
      ) : null}
      {data.interpretation ? (
        <Card>
          <Muted>{data.interpretation}</Muted>
        </Card>
      ) : null}
    </View>
  );
}

export function BodyZodiacResult({ data }: { data: BodyZodiacData }) {
  return (
    <View>
      {data.mapping?.map((m, i) => (
        <Card key={i} className="mb-2">
          <View className="flex-row justify-between mb-1">
            <Text className="text-fg font-medium">{m.sign}</Text>
            <Text className="text-fg-subtle text-xs">{m.element}</Text>
          </View>
          <Chips items={m.bodyParts} />
          {m.guidance ? <Muted className="mt-2 text-xs">{m.guidance}</Muted> : null}
        </Card>
      ))}
    </View>
  );
}
