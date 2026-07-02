import { useEffect, useRef, useState } from 'react';
import { View, Text, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useMutation } from '@tanstack/react-query';
import { ApiError, type TraditionId } from '@myastro360/shared';
import { api } from '@/api/client';
import { useAuthStore } from '@/store/auth';
import { useI18nStore } from '@/store/i18n';
import { Screen, Heading, Muted, Card, Button } from '@/components/ui';
import type { FeatureRequest, RequestCtx } from './types';
import { getFeature } from './index';
import type { FeatureSpec } from './spec';
import { FieldForm, useFeatureValues, missingRequired } from './inputs';
import { evaluateGate, PaywallCard } from './gating';
import { InterpretationPanel } from './InterpretationPanel';
import { FeatureContract } from './FeatureContract';

/**
 * Runs a Vedic feature end-to-end: profile guard → input form → gating
 * pre-check → API request → result renderer (+ interpretation panel). Features
 * without a spec (other traditions, not yet built) fall back to the endpoint
 * contract card.
 */
export function FeatureRunner({ slug, tradition }: { slug: string; tradition: TraditionId }) {
  const spec = getFeature(tradition, slug);
  if (!spec) return <FeatureContract slug={slug} tradition={tradition} />;
  if (spec.custom) {
    const Custom = spec.custom;
    return <Custom />;
  }
  return <RunnerInner key={`${tradition}:${slug}`} spec={spec} />;
}

function RunnerInner({ spec }: { spec: FeatureSpec }) {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const locale = useI18nStore((s) => s.locale);
  const ctx: RequestCtx = { user, locale };

  const [values, setValue] = useFeatureValues(spec.fields, ctx);
  const [formError, setFormError] = useState('');
  const [paywall, setPaywall] = useState<{ reason: string; costCredits?: number } | null>(null);
  const bypass = useRef(false);
  const autoRan = useRef(false);

  const profileBlocked = !!spec.requiresBirthProfile && !user?.dateOfBirth;

  const run = useMutation({
    mutationFn: (req: FeatureRequest) =>
      req.method === 'GET' ? api.get<unknown>(req.path) : api.post<unknown>(req.path, req.body ?? {}),
    onSuccess: (data) => {
      spec.onSuccess?.(data, user ?? null);
    },
    onError: (e) => {
      if (e instanceof ApiError && (e.status === 402 || e.status === 403)) {
        setPaywall({ reason: e.status === 403 ? 'needPremium' : 'needCredits' });
      }
    },
  });

  const submit = () => {
    setFormError('');
    setPaywall(null);
    const missing = missingRequired(spec.fields, values);
    if (missing.length) {
      setFormError('Please fill the required fields.');
      return;
    }
    if (!bypass.current) {
      const decision = evaluateGate(spec.gate, spec.featureKey, user ?? null);
      if (!decision.allowed) {
        setPaywall({ reason: decision.reason, costCredits: 'costCredits' in decision ? decision.costCredits : undefined });
        return;
      }
    }
    run.mutate(spec.build(values, ctx));
  };

  // Auto-run once on mount for feed-style features (panchang, dosha, horoscope…).
  useEffect(() => {
    if (spec.autoRun && !autoRan.current && !profileBlocked) {
      autoRan.current = true;
      submit();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const continueAnyway = () => {
    bypass.current = true;
    setPaywall(null);
    run.mutate(spec.build(values, ctx));
  };

  const Result = spec.Result;
  const data = run.data;

  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingVertical: 16 }}>
        <View className="flex-row items-center justify-between mb-1">
          <Heading>{spec.title}</Heading>
          <GateBadge gate={spec.gate} credits={user?.credits ?? 0} />
        </View>
        {spec.subtitle ? <Muted className="mb-4">{spec.subtitle}</Muted> : null}

        {profileBlocked ? (
          <Card>
            <Text className="text-fg font-medium mb-1">Complete your profile</Text>
            <Muted className="mb-3">This reading uses your saved birth details.</Muted>
            <Button title="Go to profile" onPress={() => router.push('/(tabs)/profile')} />
          </Card>
        ) : (
          <>
            {spec.fields.length > 0 ? (
              <Card className="mb-4">
                <FieldForm fields={spec.fields} values={values} onChange={setValue} />
                {formError ? <Text className="text-danger text-xs mt-3">{formError}</Text> : null}
                <View className="mt-4">
                  <Button
                    testID="feature-submit"
                    title={spec.submitLabel ?? 'Generate'}
                    loading={run.isPending}
                    onPress={submit}
                  />
                </View>
              </Card>
            ) : null}

            {paywall ? (
              <PaywallCard reason={paywall.reason} costCredits={paywall.costCredits} onContinue={continueAnyway} />
            ) : null}

            {run.isPending ? (
              <Card>
                <Muted>Consulting the ephemeris…</Muted>
              </Card>
            ) : null}

            {run.isError && !paywall ? (
              <Card testID="feature-error">
                <Muted className="mb-3">
                  {run.error instanceof ApiError ? run.error.message : 'Something went wrong. Please try again.'}
                </Muted>
                <Button title="Retry" variant="secondary" onPress={submit} />
              </Card>
            ) : null}

            {data != null && !run.isPending ? (
              <View className="mt-1" testID="feature-result">
                <Result data={data} />
                {spec.domain && spec.interpretationPayload ? (
                  <View className="mt-4">
                    <InterpretationPanel domain={spec.domain} payload={spec.interpretationPayload(data as never)} />
                  </View>
                ) : null}
              </View>
            ) : null}
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

const gateLabel: Record<string, string> = { free: 'Free', credit: 'Credits', entitlement: 'Unlock', premium: 'Premium' };

function GateBadge({ gate, credits }: { gate: string; credits: number }) {
  return (
    <View className="px-2.5 py-1 rounded-full bg-bg-subtle border border-border">
      <Text className="text-fg-muted text-[11px]">
        {gateLabel[gate] ?? gate}
        {gate === 'credit' ? ` · ${credits}` : ''}
      </Text>
    </View>
  );
}
