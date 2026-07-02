import { View, Text } from 'react-native';
import { Card, Muted } from '@/components/ui';
import { Section, KV, Chips, HeadlineCard } from './common';
import type { BaZiData, BaZiPillar, ChineseZodiacData, FlyingStarsData } from './responses.p3';

function Pillar({ label, p }: { label: string; p: BaZiPillar }) {
  return (
    <View className="items-center flex-1">
      <Text className="text-fg-subtle text-[11px] uppercase">{label}</Text>
      <Text className="text-fg text-base font-semibold mt-1">{p?.heavenlyStem}</Text>
      <Text className="text-fg-muted text-sm">{p?.earthlyBranch}</Text>
      <Text className="text-accent text-xs mt-1">{p?.animal}</Text>
      <Text className="text-fg-subtle text-[11px]">{p?.element}</Text>
    </View>
  );
}

export function BaZiResult({ data }: { data: BaZiData }) {
  return (
    <View>
      <Card className="mb-4">
        <Section title="Four Pillars">
          <View className="flex-row justify-between">
            <Pillar label="Year" p={data.pillars?.year} />
            <Pillar label="Month" p={data.pillars?.month} />
            <Pillar label="Day" p={data.pillars?.day} />
            <Pillar label="Hour" p={data.pillars?.hour} />
          </View>
        </Section>
      </Card>
      <Card className="mb-4">
        <KV label="Day Master" value={data.dayMaster} />
        {data.elementBalance
          ? Object.entries(data.elementBalance).map(([el, n]) => <KV key={el} label={el} value={String(n)} />)
          : null}
      </Card>
      {data.interpretation ? (
        <Card>
          <Muted>{data.interpretation}</Muted>
        </Card>
      ) : null}
    </View>
  );
}

export function ChineseZodiacResult({ data }: { data: ChineseZodiacData }) {
  return (
    <View>
      <HeadlineCard
        items={[
          { label: 'Animal', value: data.animal },
          { label: 'Element', value: data.element },
          { label: 'Yin / Yang', value: data.yinYang },
          ...(data.year ? [{ label: 'Year', value: data.year }] : []),
        ]}
      />
      {data.traits?.length ? (
        <Card className="mb-4">
          <Section title="Traits">
            <Chips items={data.traits} tone="accent" />
          </Section>
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

export function FlyingStarsResult({ data }: { data: FlyingStarsData }) {
  return (
    <View>
      <Card className="mb-4">
        <Text className="text-fg font-semibold mb-1">
          {data.year} · Center star {data.centerStar}
        </Text>
        <Muted>{data.centerMeaning}</Muted>
      </Card>
      {data.grid?.length ? (
        <Card className="mb-4">
          <Section title="Lo Shu grid">
            <View className="gap-2">
              {data.grid.map((row, r) => (
                <View key={r} className="flex-row gap-2">
                  {row.map((star, c) => (
                    <View
                      key={c}
                      className="flex-1 aspect-square rounded-lg bg-bg-subtle border border-border items-center justify-center"
                    >
                      <Text className="text-fg text-lg font-semibold">{star}</Text>
                    </View>
                  ))}
                </View>
              ))}
            </View>
          </Section>
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
