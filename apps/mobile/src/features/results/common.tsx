/**
 * Small presentational primitives shared by the feature result renderers.
 */
import { View, Text } from 'react-native';
import { Card } from '@/components/ui';

export function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View className="mb-4">
      <Text className="text-fg font-semibold mb-2">{title}</Text>
      {children}
    </View>
  );
}

export function KV({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <View className="flex-row justify-between py-1 border-b border-border/50">
      <Text className="text-fg-subtle text-xs flex-1">{label}</Text>
      <Text className="text-fg text-xs font-medium flex-1 text-right" numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}

export function Bullets({ items }: { items?: string[] }) {
  if (!items?.length) return null;
  return (
    <View className="gap-1">
      {items.map((it, i) => (
        <View key={i} className="flex-row">
          <Text className="text-accent mr-2">•</Text>
          <Text className="text-fg-muted text-sm flex-1">{it}</Text>
        </View>
      ))}
    </View>
  );
}

export function Chips({ items, tone = 'neutral' }: { items?: string[]; tone?: 'neutral' | 'accent' }) {
  if (!items?.length) return null;
  return (
    <View className="flex-row flex-wrap gap-1.5">
      {items.map((it, i) => (
        <View
          key={i}
          className={`px-2.5 py-1 rounded-full border ${
            tone === 'accent' ? 'bg-accent-subtle border-accent' : 'bg-bg-subtle border-border'
          }`}
        >
          <Text className={`text-xs ${tone === 'accent' ? 'text-accent' : 'text-fg-muted'}`}>{it}</Text>
        </View>
      ))}
    </View>
  );
}

/** A 0..max score bar with a label. */
export function ScoreBar({ score, max = 100, label }: { score: number; max?: number; label?: string }) {
  const pct = Math.max(0, Math.min(100, Math.round((score / max) * 100)));
  const tone = pct >= 66 ? 'bg-success' : pct >= 40 ? 'bg-warning' : 'bg-danger';
  return (
    <View>
      <View className="flex-row justify-between mb-1">
        <Text className="text-fg-subtle text-xs">{label ?? 'Score'}</Text>
        <Text className="text-fg text-xs font-semibold">
          {score}
          {max !== 100 ? `/${max}` : '%'}
        </Text>
      </View>
      <View className="h-2 rounded-full bg-bg-subtle overflow-hidden">
        <View className={`h-2 ${tone}`} style={{ width: `${pct}%` }} />
      </View>
    </View>
  );
}

/** Big headline card (moon sign, personal year, mulank number, ...). */
export function HeadlineCard({ items }: { items: { label: string; value: React.ReactNode }[] }) {
  return (
    <Card className="mb-4">
      <View className="flex-row flex-wrap">
        {items.map((it, i) => (
          <View key={i} className="w-1/2 mb-3">
            <Text className="text-fg-subtle text-[11px] uppercase tracking-wide">{it.label}</Text>
            <Text className="text-fg text-lg font-semibold">{it.value}</Text>
          </View>
        ))}
      </View>
    </Card>
  );
}
