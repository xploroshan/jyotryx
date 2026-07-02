import { View, Text } from 'react-native';
import { Image } from 'expo-image';
import { Card, Muted } from '@/components/ui';
import { Section, KV } from '@/features/results/common';
import type { PalmistryAnalysis } from '@/features/results/responses.p4';
import { isMajorLine, normalizeStrength, normalizeProminence } from './helpers';

const strengthTone: Record<string, string> = { strong: 'text-success', moderate: 'text-warning', weak: 'text-fg-subtle' };

export function PalmistryResult({ data, imageUri }: { data: PalmistryAnalysis; imageUri?: string }) {
  const lines = data.lines ?? [];
  const major = lines.filter((l) => isMajorLine(l.name));
  const minor = lines.filter((l) => !isMajorLine(l.name));
  const insights = [
    ['Overall', data.overallReading],
    ['Health', data.healthInsights],
    ['Career', data.careerInsights],
    ['Relationships', data.relationshipInsights],
    ['Spiritual', data.spiritualInsights],
  ].filter(([, v]) => !!v) as [string, string][];

  return (
    <View>
      {imageUri ? <Image source={{ uri: imageUri }} style={{ width: '100%', height: 180, borderRadius: 12, marginBottom: 16 }} contentFit="cover" /> : null}

      {data.atAGlance ? (
        <Card className="mb-4">
          <Section title="At a glance">
            {data.atAGlance.strengths ? <KV label="Strengths" value={data.atAGlance.strengths} /> : null}
            {data.atAGlance.lifePath ? <KV label="Life path" value={data.atAGlance.lifePath} /> : null}
            {data.atAGlance.love ? <KV label="Love" value={data.atAGlance.love} /> : null}
            {data.atAGlance.bestSuitedFor ? <KV label="Best suited for" value={data.atAGlance.bestSuitedFor} /> : null}
          </Section>
        </Card>
      ) : null}

      {major.length ? (
        <Card className="mb-4">
          <Section title="Major lines">
            {major.map((l, i) => (
              <View key={i} className="mb-3">
                <View className="flex-row justify-between">
                  <Text className="text-fg font-medium">{l.name}</Text>
                  <Text className={`text-xs uppercase ${strengthTone[normalizeStrength(l.strength)]}`}>
                    {normalizeStrength(l.strength)}
                  </Text>
                </View>
                <Text className="text-fg-muted text-sm mt-0.5">{l.interpretation}</Text>
              </View>
            ))}
          </Section>
        </Card>
      ) : null}

      {minor.length ? (
        <Card className="mb-4">
          <Section title="Other lines">
            {minor.map((l, i) => (
              <KV key={i} label={l.name} value={l.interpretation} />
            ))}
          </Section>
        </Card>
      ) : null}

      {data.mounts?.length ? (
        <Card className="mb-4">
          <Section title="Mounts">
            {data.mounts.map((m, i) => (
              <KV key={i} label={`${m.name} (${normalizeProminence(m.prominence)})`} value={m.interpretation} />
            ))}
          </Section>
        </Card>
      ) : null}

      {data.fingerAnalysis?.length ? (
        <Card className="mb-4">
          <Section title="Fingers">
            {data.fingerAnalysis.map((f, i) => (
              <KV key={i} label={`${f.finger} (${f.length})`} value={f.interpretation} />
            ))}
          </Section>
        </Card>
      ) : null}

      {insights.map(([label, body], i) => (
        <Card key={i} className="mb-3">
          <Text className="text-accent text-xs font-semibold mb-1">{label}</Text>
          <Text className="text-fg-muted text-sm leading-6">{body}</Text>
        </Card>
      ))}

      {data.cautions ? (
        <Card className="mb-3">
          <Text className="text-warning text-xs font-semibold mb-1">Cautions</Text>
          <Muted>{data.cautions}</Muted>
        </Card>
      ) : null}

      {data.closingAffirmation ? (
        <Card>
          <Muted className="italic">{data.closingAffirmation}</Muted>
        </Card>
      ) : null}
    </View>
  );
}
