import { View, Text, Share, Pressable } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { endpoints, type ReferralStatus } from '@myastro360/shared';
import { api } from '@/api/client';
import { Card, Muted, Button } from '@/components/ui';

/**
 * Referral program card (GET /referral/me). Mirrors the web page: share your
 * code, both sides get bonusDays of Premium; stats + share sheet with the same
 * message template. Hidden entirely while the program is disabled.
 */
export function ReferralCard() {
  const q = useQuery({
    queryKey: ['referral'],
    queryFn: () => api.get<ReferralStatus>(endpoints.referral.me),
    staleTime: 5 * 60 * 1000,
  });

  const data = q.data;
  if (q.isLoading || !data || !data.enabled) return null;

  const share = () =>
    Share.share({
      message: `Join me on MyAstro360! Sign up with my code ${data.code} and we both get ${data.bonusDays} days of Premium for free. ${data.shareUrl}`,
    }).catch(() => {});

  const daysEarned = data.activatedReferrals * data.bonusDays;

  return (
    <Card testID="referral-card">
      <Text className="text-fg font-semibold mb-1">Invite friends, earn Premium</Text>
      <Muted className="mb-3">
        You both get {data.bonusDays} days of Premium per activated invite
        {data.remainingSlots > 0 ? ` · ${data.remainingSlots} slots left` : ' · limit reached'}.
      </Muted>

      <Pressable
        testID="referral-code"
        onPress={share}
        className="rounded-lg border border-dashed border-accent bg-accent-subtle py-3 items-center mb-3"
      >
        <Text className="text-accent text-lg font-bold tracking-widest">{data.code}</Text>
        <Muted className="text-[11px] mt-0.5">tap to share</Muted>
      </Pressable>

      <View className="flex-row justify-between mb-3">
        <Stat label="Activated" value={data.activatedReferrals} />
        <Stat label="Pending" value={data.pendingReferrals} />
        <Stat label="Days earned" value={daysEarned} />
      </View>

      <Button testID="referral-share" title="Share invite" variant="secondary" onPress={share} />
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <View className="items-center flex-1">
      <Text className="text-fg text-lg font-bold">{value}</Text>
      <Muted className="text-[11px]">{label}</Muted>
    </View>
  );
}
