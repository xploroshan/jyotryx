import { View, Text } from 'react-native';
import { Card } from '@/components/ui';
import { Section, KV, ScoreBar } from './common';
import type { HoroscopeData, PanchangData, MuhuratData, CosmicData, DecisionData } from './responses';

export function HoroscopeResult({ data }: { data: HoroscopeData }) {
  const overview = data.prediction ?? data.forecast;
  const luckyNumber = data.luckyNumber ?? data.lucky_number;
  const luckyColor = data.luckyColor ?? data.lucky_color;
  return (
    <View>
      {overview ? (
        <Card className="mb-4">
          <Text className="text-fg-muted leading-6">{overview}</Text>
        </Card>
      ) : null}
      <Card className="mb-4">
        {data.love ? <Field label="Love" value={data.love} /> : null}
        {data.career ? <Field label="Career" value={data.career} /> : null}
        {data.health ? <Field label="Health" value={data.health} /> : null}
      </Card>
      <Card>
        {luckyNumber != null ? <KV label="Lucky number" value={String(luckyNumber)} /> : null}
        {luckyColor ? <KV label="Lucky colour" value={luckyColor} /> : null}
        {data.compatibility ? <KV label="Compatibility" value={data.compatibility} /> : null}
        {data.mood ? <KV label="Mood" value={data.mood} /> : null}
      </Card>
    </View>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <View className="mb-3">
      <Text className="text-accent text-xs font-semibold mb-0.5">{label}</Text>
      <Text className="text-fg-muted text-sm">{value}</Text>
    </View>
  );
}

export function PanchangResult({ data }: { data: PanchangData }) {
  return (
    <View>
      <Card className="mb-4">
        <Section title={`Panchang · ${data.date?.slice(0, 10) ?? ''}`}>
          <KV label="Tithi" value={data.tithi} />
          <KV label="Nakshatra" value={data.nakshatra} />
          <KV label="Yoga" value={data.yoga} />
          <KV label="Karana" value={data.karana} />
          <KV label="Vara" value={data.vara} />
        </Section>
      </Card>
      <Card>
        <Section title="Timings">
          <KV label="Sunrise" value={data.sunrise} />
          <KV label="Sunset" value={data.sunset} />
          <KV label="Moonrise" value={data.moonrise} />
          <KV label="Rahu Kaal" value={data.rahukaal} />
          <KV label="Gulika Kaal" value={data.gulikakaal} />
          <KV label="Yamakantaka" value={data.yamakantaka} />
        </Section>
      </Card>
    </View>
  );
}

const qualityTone: Record<string, string> = {
  excellent: 'text-success',
  good: 'text-success',
  average: 'text-warning',
};

export function MuhuratResult({ data }: { data: MuhuratData }) {
  if (!data.auspiciousTimes?.length) {
    return (
      <Card>
        <Text className="text-fg-muted">No auspicious windows found in that range.</Text>
      </Card>
    );
  }
  return (
    <View>
      {data.auspiciousTimes.map((t, i) => (
        <Card key={i} className="mb-3">
          <View className="flex-row justify-between">
            <Text className="text-fg font-medium">{t.date?.slice(0, 10)}</Text>
            <Text className={`text-xs font-semibold uppercase ${qualityTone[t.quality] ?? 'text-fg-muted'}`}>
              {t.quality}
            </Text>
          </View>
          <Text className="text-accent text-sm mt-1">
            {t.startTime} – {t.endTime}
          </Text>
          <Text className="text-fg-muted text-xs mt-1">{t.reason}</Text>
        </Card>
      ))}
    </View>
  );
}

const recoTone: Record<string, string> = {
  excellent: 'text-success',
  good: 'text-success',
  neutral: 'text-fg-muted',
  caution: 'text-warning',
  avoid: 'text-danger',
};

export function CosmicResult({ data }: { data: CosmicData }) {
  const best = [...(data.days ?? [])].sort((a, b) => b.score - a.score).slice(0, 8);
  return (
    <View>
      <Text className="text-fg-subtle text-xs mb-2">
        Best {data.activity} days · {data.location}
      </Text>
      {best.map((d, i) => (
        <Card key={i} className="mb-2">
          <View className="flex-row justify-between items-center">
            <Text className="text-fg font-medium">{d.date}</Text>
            <Text className={`text-xs font-semibold uppercase ${recoTone[d.recommendation] ?? 'text-fg-muted'}`}>
              {d.recommendation} · {d.score}
            </Text>
          </View>
          <Text className="text-fg-muted text-xs mt-1">
            {d.tithi} · {d.nakshatra}
          </Text>
        </Card>
      ))}
    </View>
  );
}

export function DecisionResult({ data }: { data: DecisionData }) {
  return (
    <View>
      <Card className="mb-4">
        <ScoreBar score={data.score} label={`${data.activity} · ${data.date}`} />
        <Text className={`text-xs font-semibold uppercase mt-2 ${recoTone[data.recommendation] ?? 'text-fg-muted'}`}>
          {data.recommendation}
        </Text>
      </Card>
      {data.factors?.length ? (
        <Card className="mb-4">
          <Section title="Why">
            {data.factors.slice(0, 8).map((f, i) => (
              <View key={i} className="flex-row py-1">
                <Text
                  className={
                    f.contribution === 'positive'
                      ? 'text-success mr-2'
                      : f.contribution === 'negative'
                        ? 'text-danger mr-2'
                        : 'text-fg-subtle mr-2'
                  }
                >
                  {f.contribution === 'positive' ? '▲' : f.contribution === 'negative' ? '▼' : '•'}
                </Text>
                <Text className="text-fg-muted text-sm flex-1">{f.label}</Text>
              </View>
            ))}
          </Section>
        </Card>
      ) : null}
      {data.panchang ? (
        <Card>
          <Section title="Panchang">
            <KV label="Tithi" value={data.panchang.tithi} />
            <KV label="Nakshatra" value={data.panchang.nakshatra} />
            <KV label="Rahu Kaal" value={data.panchang.rahuKaal} />
          </Section>
        </Card>
      ) : null}
    </View>
  );
}
