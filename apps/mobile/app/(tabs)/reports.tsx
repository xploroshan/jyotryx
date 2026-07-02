import { View, Text } from 'react-native';
import { Screen, Heading, Muted, Card } from '@/components/ui';

const REPORT_TYPES = ['Life', 'Career', 'Marriage', 'Wealth', 'Annual', 'Palm'] as const;

/**
 * Reports hub — entitlement-gated generation via POST /reports/generate, with
 * GET /reports/:id/status polling and GET /reports history (verified). Purchase
 * + generation flow is the P4 milestone; this lists the report catalogue.
 */
export default function Reports() {
  return (
    <Screen>
      <Heading className="mt-4 mb-3">Reports</Heading>
      <View className="flex-row flex-wrap justify-between">
        {REPORT_TYPES.map((r) => (
          <Card key={r} testID={`report-${r.toLowerCase()}`} className="w-[48%] mb-3">
            <Text className="text-fg font-medium">{r}</Text>
            <Muted className="mt-1">Entitlement</Muted>
          </Card>
        ))}
      </View>
      <Muted className="mt-2">
        Generation + purchase (Play Billing / consumption) arrives in P4–P5.
      </Muted>
    </Screen>
  );
}
