import { View } from 'react-native';
import { Card, Muted } from '@/components/ui';
import { Section, KV, HeadlineCard } from './common';
import type { ProfectionsData, ZodiacalReleasingData } from './responses.p3';

export function ProfectionsResult({ data }: { data: ProfectionsData }) {
  return (
    <View>
      <HeadlineCard
        items={[
          { label: 'Age', value: data.ageYears },
          { label: 'Profected house', value: data.profectedHouse },
          { label: 'Sign', value: data.profectedSign },
          { label: 'Lord of year', value: data.lordOfYear },
        ]}
      />
      {data.interpretation ? (
        <Card>
          <Muted>{data.interpretation}</Muted>
        </Card>
      ) : null}
    </View>
  );
}

export function ZodiacalReleasingResult({ data }: { data: ZodiacalReleasingData }) {
  return (
    <View>
      <Card className="mb-4">
        <Section title={`Major period · age ${data.ageYears}`}>
          <KV label="Sign" value={data.majorPeriod?.sign} />
          <KV label="Lord" value={data.majorPeriod?.lord} />
          <Muted className="mt-2">{data.majorPeriod?.description}</Muted>
        </Section>
      </Card>
      <Card className="mb-4">
        <Section title="Minor period">
          <KV label="Sign" value={data.minorPeriod?.sign} />
          <KV label="Lord" value={data.minorPeriod?.lord} />
          <Muted className="mt-2">{data.minorPeriod?.description}</Muted>
        </Section>
      </Card>
      {data.interpretation ? (
        <Card>
          <Muted>{data.interpretation}</Muted>
        </Card>
      ) : null}
    </View>
  );
}
