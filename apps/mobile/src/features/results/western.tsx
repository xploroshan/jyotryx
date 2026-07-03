import { View, Text } from 'react-native';
import { Card, Muted } from '@/components/ui';
import { Section, KV, ScoreBar } from './common';
import type { WesternNatalData, TransitsData, SynastryData } from './responses.p3';

const deg = (n: number) => `${Math.round(n)}°`;

export function WesternNatalResult({ data }: { data: WesternNatalData }) {
  return (
    <View>
      <Card className="mb-4">
        <KV label="Ascendant" value={`${data.ascendant?.sign} · ${deg(data.ascendant?.degree ?? 0)}`} />
      </Card>
      <Card className="mb-4">
        <Section title="Planets">
          {data.planets?.map((p, i) => (
            <KV key={i} label={p.planet} value={`${p.sign} · ${deg(p.degree)}${p.house != null ? ` · H${p.house}` : ''}`} />
          ))}
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

export function TransitsResult({ data }: { data: TransitsData }) {
  return (
    <View>
      <Card className="mb-4">
        <Section title={`Transits · ${data.date ?? ''}`}>
          {data.transitingPlanets?.slice(0, 12).map((p, i) => (
            <KV key={i} label={p.planet} value={`${p.sign} · ${deg(p.degree)}`} />
          ))}
        </Section>
      </Card>
      {data.aspects?.length ? (
        <Card className="mb-4">
          <Section title="Aspects">
            {data.aspects.slice(0, 10).map((a, i) => (
              <KV key={i} label={`${a.transiting} → ${a.natal}`} value={`${a.aspect} (${deg(a.orb)})`} />
            ))}
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

export function SynastryResult({ data }: { data: SynastryData }) {
  const c = data.compatibility;
  return (
    <View>
      {c ? (
        <Card className="mb-4">
          <ScoreBar score={c.score} label="Compatibility" />
          <View className="flex-row gap-4 mt-2">
            <Text className="text-success text-xs">Harmonious: {c.harmonious}</Text>
            <Text className="text-danger text-xs">Challenging: {c.challenging}</Text>
          </View>
          {c.summary ? <Muted className="mt-2">{c.summary}</Muted> : null}
        </Card>
      ) : null}
      <Card className="mb-4">
        <Section title="Partner A">
          <KV label="Ascendant" value={data.partner1?.ascendant?.sign} />
          <KV label="Sun" value={`${data.partner1?.sun?.sign} · ${data.partner1?.sun?.element}`} />
          <KV label="Moon" value={data.partner1?.moon?.sign} />
        </Section>
        <Section title="Partner B">
          <KV label="Ascendant" value={data.partner2?.ascendant?.sign} />
          <KV label="Sun" value={`${data.partner2?.sun?.sign} · ${data.partner2?.sun?.element}`} />
          <KV label="Moon" value={data.partner2?.moon?.sign} />
        </Section>
      </Card>
      {data.aspects?.length ? (
        <Card>
          <Section title="Aspects">
            {data.aspects.slice(0, 10).map((a, i) => (
              <View key={i} className="flex-row justify-between py-1 border-b border-border/50">
                <Text className="text-fg-subtle text-xs flex-1">
                  {a.a} → {a.b}
                </Text>
                <Text className={`text-xs font-medium ${a.quality === 'harmonious' ? 'text-success' : 'text-danger'}`}>
                  {a.aspect}
                </Text>
              </View>
            ))}
          </Section>
        </Card>
      ) : null}
    </View>
  );
}
