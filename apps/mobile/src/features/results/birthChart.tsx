import { View, Text } from 'react-native';
import { Card } from '@/components/ui';
import { Section, KV, Bullets, ScoreBar, HeadlineCard } from './common';
import type { KundliData, DashaPeriod, DoshaData, DivisionalData, KpData, MatchingData } from './responses';

const fmtDate = (s: string) => (s ? s.slice(0, 10) : '');

function DashaList({ dashas }: { dashas: DashaPeriod[] }) {
  return (
    <View>
      {dashas.slice(0, 9).map((d, i) => (
        <KV key={i} label={d.planet} value={`${fmtDate(d.startDate)} → ${fmtDate(d.endDate)}`} />
      ))}
    </View>
  );
}

export function KundliResult({ data }: { data: KundliData }) {
  return (
    <View>
      <HeadlineCard
        items={[
          { label: 'Ascendant', value: data.ascendant },
          { label: 'Moon sign', value: data.moonSign },
          { label: 'Sun sign', value: data.sunSign },
          { label: 'Nakshatra', value: data.nakshatra },
        ]}
      />
      <Card className="mb-4">
        <Section title="Planetary positions">
          {data.planetaryPositions?.slice(0, 12).map((p, i) => (
            <KV
              key={i}
              label={`${p.planet}${p.isRetrograde ? ' ℞' : ''}`}
              value={`${p.sign} · H${p.house} · ${Math.round(p.degree)}°`}
            />
          ))}
        </Section>
      </Card>
      {data.dashas?.length ? (
        <Card className="mb-4">
          <Section title="Vimshottari Dasha">
            <DashaList dashas={data.dashas} />
          </Section>
        </Card>
      ) : null}
      {data.yogas?.length ? (
        <Card>
          <Section title="Yogas">
            {data.yogas.slice(0, 6).map((y, i) => (
              <View key={i} className="mb-2">
                <Text className="text-fg text-sm font-medium">{y.name}</Text>
                <Text className="text-fg-muted text-xs">{y.description}</Text>
              </View>
            ))}
          </Section>
        </Card>
      ) : null}
    </View>
  );
}

export function DashaResult({ data }: { data: KundliData }) {
  const current = data.dashas?.[0];
  return (
    <View>
      {current ? (
        <HeadlineCard
          items={[
            { label: 'Current Mahadasha', value: current.planet },
            { label: 'Until', value: fmtDate(current.endDate) },
          ]}
        />
      ) : null}
      <Card>
        <Section title="Mahadasha timeline">
          <DashaList dashas={data.dashas ?? []} />
        </Section>
      </Card>
    </View>
  );
}

const severityTone: Record<string, string> = {
  none: 'text-success',
  mild: 'text-warning',
  moderate: 'text-warning',
  severe: 'text-danger',
};

export function DoshaResult({ data }: { data: DoshaData }) {
  return (
    <View>
      {data.doshas?.map((d, i) => (
        <Card key={i} className="mb-3">
          <View className="flex-row justify-between items-center mb-1">
            <Text className="text-fg font-semibold">{d.name}</Text>
            <Text className={`text-xs font-semibold uppercase ${severityTone[d.severity] ?? 'text-fg-muted'}`}>
              {d.present ? d.severity : 'not present'}
            </Text>
          </View>
          <Text className="text-fg-muted text-sm mb-2">{d.description}</Text>
          {d.present && d.remedies?.length ? (
            <>
              <Text className="text-fg-subtle text-xs mb-1">Remedies</Text>
              <Bullets items={d.remedies} />
            </>
          ) : null}
        </Card>
      ))}
    </View>
  );
}

export function DivisionalResult({ data }: { data: DivisionalData }) {
  return (
    <Card>
      <Section title={`${data.type ?? 'Divisional'} chart (D${data.divisor})`}>
        {data.positions?.map((p, i) => (
          <KV key={i} label={p.planet} value={`${p.sign} · ${Math.round(p.degree)}°`} />
        ))}
      </Section>
    </Card>
  );
}

export function KpResult({ data }: { data: KpData }) {
  return (
    <View>
      <Card className="mb-4">
        <Section title="Planets (star & sub lords)">
          {data.planets?.map((p, i) => (
            <KV key={i} label={p.planet} value={`${p.sign} · ${p.starLord}/${p.subLord}`} />
          ))}
        </Section>
      </Card>
      <Card>
        <Section title="House cusps">
          {data.cusps?.slice(0, 12).map((c, i) => (
            <KV key={i} label={`Cusp ${c.cusp}`} value={`${c.sign} · ${c.starLord}/${c.subLord}`} />
          ))}
        </Section>
      </Card>
    </View>
  );
}

export function MatchingResult({ data }: { data: MatchingData }) {
  const total = data.totalScore ?? 0;
  const max = data.maxScore ?? 36;
  return (
    <View>
      <Card className="mb-4">
        <ScoreBar score={Math.round((total / max) * 100)} label="Guna Milan" />
        <Text className="text-fg-muted text-xs mt-1">
          {total}/{max} gunas · {data.compatibility}
        </Text>
        <View className="flex-row gap-2 mt-3">
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
          <Text className="text-fg-muted text-sm">{data.recommendation}</Text>
        </Card>
      ) : null}
    </View>
  );
}
