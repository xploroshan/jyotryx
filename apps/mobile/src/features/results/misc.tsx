import { View, Text } from 'react-native';
import { Card, Muted } from '@/components/ui';
import { Section, KV, Chips, Bullets, ScoreBar, HeadlineCard } from './common';
import type { NameData, BrandData, PersonalYearData, MulankData, TarotData, VastuData } from './responses';

type NumerologyAny = Partial<NameData & BrandData & PersonalYearData>;

/** Numerology returns a different shape per mode; discriminate by a marker key. */
export function NumerologyResult({ data }: { data: NumerologyAny }) {
  if (data.personalYear != null) return <PersonalYearView data={data as PersonalYearData} />;
  if (data.nameNumber != null) return <BrandView data={data as BrandData} />;
  return <NameView data={data as NameData} />;
}

function NameView({ data }: { data: NameData }) {
  return (
    <View>
      <HeadlineCard
        items={[
          { label: 'Destiny', value: data.destinyNumber },
          { label: 'Soul', value: data.soulNumber },
          { label: 'Personality', value: data.personalityNumber },
          { label: 'Verdict', value: (data.overallVerdict ?? '').replace(/_/g, ' ') },
        ]}
      />
      <Card className="mb-4">
        <Section title="Meanings">
          <Text className="text-fg-muted text-sm mb-2">{data.destinyMeaning}</Text>
          <Text className="text-fg-muted text-sm mb-2">{data.soulMeaning}</Text>
          <Text className="text-fg-muted text-sm">{data.personalityMeaning}</Text>
        </Section>
      </Card>
      <Card>
        {data.rulingPlanet ? <KV label="Ruling planet" value={data.rulingPlanet} /> : null}
        <View className="mt-2 mb-1">
          <Text className="text-fg-subtle text-xs mb-1">Lucky colours</Text>
          <Chips items={data.luckyColors} tone="accent" />
        </View>
        {data.suggestion ? <Muted className="mt-2">{data.suggestion}</Muted> : null}
      </Card>
    </View>
  );
}

function BrandView({ data }: { data: BrandData }) {
  return (
    <View>
      <Card className="mb-4">
        <ScoreBar score={Math.round((data.overallScore ?? 0) * 10)} label="Brand vibration" />
        <Text className="text-fg-muted text-xs mt-1">
          Number {data.nameNumber} · {data.vibration} · ruled by {data.planetaryRuler}
        </Text>
      </Card>
      <Card className="mb-3">
        <Section title="Suitable for">
          <Chips items={data.suitableFor} tone="accent" />
        </Section>
        <Section title="Avoid for">
          <Chips items={data.avoidFor} />
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

function PersonalYearView({ data }: { data: PersonalYearData }) {
  return (
    <View>
      <HeadlineCard
        items={[
          { label: 'Personal year', value: data.personalYear },
          { label: 'Theme', value: data.theme },
        ]}
      />
      <Card className="mb-4">
        <Muted>{data.description}</Muted>
      </Card>
      <Card>
        <KV label="Career" value={data.career} />
        <KV label="Finance" value={data.finance} />
        <KV label="Relationships" value={data.relationships} />
        <KV label="Health" value={data.health} />
      </Card>
    </View>
  );
}

export function MulankResult({ data }: { data: MulankData }) {
  if (data.hasBirthDetails === false) {
    return (
      <Card>
        <Muted>Add your date of birth in your profile to see your Mulank reading.</Muted>
      </Card>
    );
  }
  return (
    <View>
      <HeadlineCard
        items={[
          { label: 'Mulank', value: data.mulank },
          { label: 'Bhagyank', value: data.bhagyank },
          { label: 'Planet', value: data.mulankProfile?.planet ?? '' },
          { label: 'Title', value: data.mulankProfile?.title ?? '' },
        ]}
      />
      {data.summary ? (
        <Card className="mb-4">
          <Muted>{data.summary}</Muted>
        </Card>
      ) : null}
      {data.mulankProfile?.strengths?.length ? (
        <Card className="mb-4">
          <Section title="Strengths">
            <Bullets items={data.mulankProfile.strengths} />
          </Section>
        </Card>
      ) : null}
      {data.luckyNumbers?.length ? (
        <Card>
          <Section title="Lucky numbers">
            <Chips items={data.luckyNumbers.map(String)} tone="accent" />
          </Section>
        </Card>
      ) : null}
    </View>
  );
}

export function TarotResult({ data }: { data: TarotData }) {
  return (
    <View>
      {data.cards?.map((c, i) => (
        <Card key={i} className="mb-3">
          <View className="flex-row justify-between">
            <Text className="text-fg font-semibold">
              {c.name}
              {c.isReversed ? ' (reversed)' : ''}
            </Text>
            <Text className="text-fg-subtle text-xs">{c.position}</Text>
          </View>
          <Text className="text-fg-muted text-sm mt-1">{c.isReversed ? c.reversed : c.meaning}</Text>
        </Card>
      ))}
      <Card className="mb-3">
        <Section title="Reading">
          <Text className="text-fg-muted text-sm mb-2">{data.interpretation?.overall}</Text>
          {data.interpretation?.advice ? (
            <>
              <Text className="text-accent text-xs font-semibold mt-1">Advice</Text>
              <Text className="text-fg-muted text-sm">{data.interpretation.advice}</Text>
            </>
          ) : null}
        </Section>
      </Card>
      {data.interpretation?.spiritualGuidance ? (
        <Card>
          <Muted>{data.interpretation.spiritualGuidance}</Muted>
        </Card>
      ) : null}
    </View>
  );
}

export function VastuResult({ data }: { data: VastuData }) {
  return (
    <View>
      <Card className="mb-4">
        <ScoreBar score={data.entrance?.score ?? 0} label={`Entrance · ${data.entrance?.direction}`} />
        <Text className="text-fg-muted text-xs mt-1">
          {data.entrance?.verdict} · {data.entrance?.deity} · {data.entrance?.element}
        </Text>
      </Card>
      {data.insights?.summary ? (
        <Card className="mb-4">
          <Muted>{data.insights.summary}</Muted>
        </Card>
      ) : null}
      {data.propertyTips?.length ? (
        <Card className="mb-4">
          <Section title="Tips">
            <Bullets items={data.propertyTips} />
          </Section>
        </Card>
      ) : null}
      {data.insights?.remedies?.length ? (
        <Card>
          <Section title="Remedies">
            <Bullets items={data.insights.remedies} />
          </Section>
          {data.insights.gemstone ? <KV label="Gemstone" value={data.insights.gemstone} /> : null}
          {data.insights.mantra ? <KV label="Mantra" value={data.insights.mantra} /> : null}
        </Card>
      ) : null}
    </View>
  );
}
