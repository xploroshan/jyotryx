import { View, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { resolveAccess, type FeatureGate, type GatingConfig, type UserAccess, type User } from '@myastro360/shared';
import { Card, Button, Muted } from '@/components/ui';

/**
 * Client-side gating for pre-flight UX only — the API's feature-access service
 * is the real gate. Mobile doesn't yet fetch SiteSettings or entitlements, so
 * we use conservative defaults; a denied pre-check always offers "Continue
 * anyway" so a mis-set default (e.g. free_mode on) never hard-blocks the user.
 */
export const DEFAULT_GATING: GatingConfig = {
  freeMode: false,
  subscriptionsEnabled: true,
  creditCosts: {},
};

export function toUserAccess(user: User | null): UserAccess {
  return {
    credits: user?.credits ?? 0,
    // Premium + entitlements aren't tracked on-device yet; the backend enforces
    // them. Treat as absent so the pre-check errs toward showing the paywall.
    isPremium: false,
    entitlements: [],
  };
}

export function evaluateGate(gate: FeatureGate, featureKey: string, user: User | null) {
  return resolveAccess(gate, featureKey, DEFAULT_GATING, toUserAccess(user));
}

const reasonCopy: Record<string, string> = {
  needCredits: "You're low on credits for this reading.",
  needEntitlement: 'This is a one-time unlock.',
  needPremium: 'This feature is part of Premium.',
};

export function PaywallCard({
  reason,
  costCredits,
  onContinue,
}: {
  reason: string;
  costCredits?: number;
  onContinue: () => void;
}) {
  const router = useRouter();
  return (
    <Card testID="paywall">
      <Text className="text-fg font-semibold mb-1">Unlock this reading</Text>
      <Muted className="mb-3">
        {reasonCopy[reason] ?? 'This reading needs credits or Premium.'}
        {costCredits ? ` (${costCredits} credits)` : ''}
      </Muted>
      <View className="gap-2">
        <Button testID="paywall-get-credits" title="Get credits" onPress={() => router.push('/pricing')} />
        <Button title="Continue anyway" variant="secondary" onPress={onContinue} />
      </View>
    </Card>
  );
}
