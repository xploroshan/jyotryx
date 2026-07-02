import { useEffect, useState } from 'react';
import { View, Text, Pressable, ScrollView, Linking } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { endpoints, type User } from '@myastro360/shared';
import { api } from '@/api/client';
import { useAuthStore } from '@/store/auth';
import { Screen, Heading, Muted, Card, Button } from '@/components/ui';
import { WEB_ORIGIN } from '@/lib/config';
import { usePricing } from './usePricing';
import { allProductSkus, SUBSCRIPTION_SKUS, type CreditPack } from './products';
import { getCatalog, buyProduct, buySubscription, restorePurchases, type CatalogEntry } from './iap';

const fmtINR = (n: number) => `₹${n.toLocaleString('en-IN')}`;

/**
 * Pricing — the Play Billing storefront (Rail B) + the consumption rail's
 * region-gated web link (Rail A). Credit packs and Premium buy through Play,
 * verify server-side, then re-sync the user. The "buy on the web" link renders
 * ONLY when storePolicy.allowWebCheckoutLink is true (hidden by default —
 * India anti-steering compliant).
 */
export function PricingScreen() {
  const qc = useQueryClient();
  const { user, updateCredits } = useAuthStore();
  const { pricing, isLoading } = usePricing();
  const [catalog, setCatalog] = useState<CatalogEntry[]>([]);
  const [busySku, setBusySku] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null);

  useEffect(() => {
    getCatalog(allProductSkus(), [SUBSCRIPTION_SKUS.monthly, SUBSCRIPTION_SKUS.annual]).then(setCatalog);
  }, []);

  const playPrice = (sku: string) => catalog.find((c) => c.sku === sku)?.localizedPrice ?? null;

  /** Re-sync credits/role from the server after a verified grant. */
  const refreshUser = async () => {
    try {
      const me = await api.get<User>(endpoints.user.me);
      updateCredits(me.credits);
      qc.invalidateQueries({ queryKey: ['pricing'] });
    } catch {
      /* non-fatal — webhooks/next launch reconcile */
    }
  };

  const onBuyPack = async (pack: CreditPack) => {
    setNotice(null);
    setBusySku(pack.sku);
    const res = await buyProduct(pack.sku);
    setBusySku(null);
    if (res.ok) {
      await refreshUser();
      setNotice({ tone: 'ok', text: `Added ${res.creditsAdded ?? pack.credits} credits ✨` });
    } else {
      setNotice({ tone: 'err', text: res.message ?? 'Purchase failed.' });
    }
  };

  const onSubscribe = async (tier: 'monthly' | 'annual') => {
    setNotice(null);
    const sku = SUBSCRIPTION_SKUS[tier];
    setBusySku(sku);
    const res = await buySubscription(sku);
    setBusySku(null);
    if (res.ok) {
      await refreshUser();
      setNotice({ tone: 'ok', text: 'Welcome to Premium ✨' });
    } else {
      setNotice({ tone: 'err', text: res.message ?? 'Subscription failed.' });
    }
  };

  const onRestore = async () => {
    setNotice(null);
    setBusySku('restore');
    const res = await restorePurchases();
    setBusySku(null);
    if (res.restored > 0) {
      await refreshUser();
      setNotice({ tone: 'ok', text: `Restored ${res.restored} purchase(s).` });
    } else {
      setNotice({ tone: 'err', text: res.message ?? 'No purchases to restore.' });
    }
  };

  if (isLoading) {
    return (
      <Screen>
        <Muted className="mt-8">Loading pricing…</Muted>
      </Screen>
    );
  }

  // Operator modes mirroring web: free mode / pricing page disabled → no store.
  if (pricing.freeMode || !pricing.pricingEnabled) {
    return (
      <Screen>
        <Heading className="mt-4 mb-3">Pricing</Heading>
        <Card testID="pricing-free">
          <Text className="text-fg font-semibold mb-1">MyAstro360 is 100% free right now 🎉</Text>
          <Muted>All readings are on the house. Enjoy!</Muted>
        </Card>
      </Screen>
    );
  }

  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingVertical: 16 }}>
        <Heading className="mb-1">Get more readings</Heading>
        <Muted className="mb-1">Credits power individual readings; Premium unlocks everything.</Muted>
        <Muted className="mb-4">
          Balance: <Text className="text-accent font-semibold">{user?.credits ?? 0} credits</Text>
        </Muted>

        {notice ? (
          <Card className="mb-4" testID="pricing-notice">
            <Text className={notice.tone === 'ok' ? 'text-success text-sm' : 'text-danger text-sm'}>
              {notice.text}
            </Text>
          </Card>
        ) : null}

        <Text className="text-fg font-semibold mb-2">Credit packs</Text>
        <View className="flex-row flex-wrap justify-between mb-5">
          {pricing.packs.map((pack) => (
            <Card key={pack.sku} className="w-[31%] items-center py-4" testID={`pack-${pack.packId}`}>
              <Text className="text-fg text-lg font-bold">{pack.credits}</Text>
              <Muted className="text-[11px] mb-2">credits</Muted>
              <Button
                title={busySku === pack.sku ? '…' : playPrice(pack.sku) ?? fmtINR(pack.priceINR)}
                loading={busySku === pack.sku}
                variant="secondary"
                onPress={() => onBuyPack(pack)}
              />
            </Card>
          ))}
        </View>

        {pricing.subscriptionsEnabled ? (
          <>
            <Text className="text-fg font-semibold mb-2">Premium</Text>
            {(['annual', 'monthly'] as const).map((tier) => {
              const price = tier === 'annual' ? pricing.annualPrice : pricing.monthlyPrice;
              const sku = SUBSCRIPTION_SKUS[tier];
              const recommended = pricing.recommended === tier;
              return (
                <Card key={tier} className={`mb-3 ${recommended ? 'border-accent' : ''}`} testID={`plan-${tier}`}>
                  <View className="flex-row items-center justify-between mb-2">
                    <Text className="text-fg font-semibold capitalize">{tier}</Text>
                    {recommended ? (
                      <View className="px-2 py-0.5 rounded-full bg-accent-subtle">
                        <Text className="text-accent text-[11px]">Most popular</Text>
                      </View>
                    ) : null}
                  </View>
                  <Text className="text-fg text-xl font-bold mb-1">
                    {playPrice(sku) ?? fmtINR(price)}
                    <Text className="text-fg-subtle text-xs font-normal"> / {tier === 'annual' ? 'year' : 'month'}</Text>
                  </Text>
                  {tier === 'annual' ? (
                    <Muted className="mb-3 text-xs">≈ {fmtINR(Math.round(pricing.annualPrice / 12))}/month</Muted>
                  ) : (
                    <View className="mb-3" />
                  )}
                  <Button
                    title={busySku === sku ? 'Opening Play…' : 'Subscribe'}
                    loading={busySku === sku}
                    onPress={() => onSubscribe(tier)}
                  />
                </Card>
              );
            })}
          </>
        ) : null}

        <Pressable testID="pricing-restore" onPress={onRestore} className="items-center py-3">
          <Text className="text-accent text-sm">{busySku === 'restore' ? 'Restoring…' : 'Restore purchases'}</Text>
        </Pressable>

        {/* Rail A — shown ONLY where store policy allows steering to web. */}
        {pricing.storePolicy.allowWebCheckoutLink ? (
          <Pressable
            testID="pricing-web-link"
            onPress={() => Linking.openURL(`${WEB_ORIGIN}/pricing`)}
            className="items-center py-2"
          >
            <Muted className="underline">Also available on myastro360.com</Muted>
          </Pressable>
        ) : null}
      </ScrollView>
    </Screen>
  );
}
