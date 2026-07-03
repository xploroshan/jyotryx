import { useState } from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { useQuery, useMutation } from '@tanstack/react-query';
import { ApiError } from '@myastro360/shared';
import { useAuthStore } from '@/store/auth';
import { useI18nStore } from '@/store/i18n';
import { Screen, Heading, Muted, Card, Button } from '@/components/ui';
import type { ReportResponse, ReportListItem } from '@/features/results/responses.p4';
import { REPORT_TYPES, isReportDone } from './reportStatus';
import { generateAndWait, getReport, listReports } from './api';
import { reportSku } from '@/payments/products';
import { buyProduct } from '@/payments/iap';
import { usePricing } from '@/payments/usePricing';

/**
 * Reports hub — generate (6 types, async job) + history, with an inline reader.
 * Birth details are read server-side from the profile, so generate just needs
 * a saved profile. Locked reports return 402 (purchase ships with payments, P5).
 */
export function ReportsScreen() {
  const user = useAuthStore((s) => s.user);
  const locale = useI18nStore((s) => s.locale);
  const { pricing } = usePricing();
  const [tab, setTab] = useState<'generate' | 'history'>('generate');
  const [reading, setReading] = useState<ReportResponse | null>(null);
  const [lockedType, setLockedType] = useState<string | null>(null);
  const [buying, setBuying] = useState(false);
  const [buyError, setBuyError] = useState('');
  const [pendingType, setPendingType] = useState<string | null>(null);

  const gen = useMutation({
    mutationFn: (type: string) => generateAndWait(type, locale),
    onMutate: (type) => {
      setLockedType(null);
      setBuyError('');
      setPendingType(type);
    },
    onSuccess: (report) => setReading(report),
    onError: (e, type) => {
      if (e instanceof ApiError && e.status === 402) setLockedType(type);
    },
    onSettled: () => setPendingType(null),
  });

  /** Buy the exact report unlock via Play, then auto-retry generation once —
   *  the mobile analogue of web's `/checkout?type=report` → `?unlocked=` flow. */
  const onUnlock = async () => {
    if (!lockedType) return;
    setBuying(true);
    setBuyError('');
    const res = await buyProduct(reportSku(lockedType));
    setBuying(false);
    if (res.ok && res.entitlementGranted) {
      const type = lockedType;
      setLockedType(null);
      gen.mutate(type);
    } else {
      setBuyError(res.message ?? 'Purchase failed.');
    }
  };

  const history = useQuery({
    queryKey: ['reports'],
    queryFn: listReports,
    enabled: tab === 'history' && !reading,
  });

  const open = useMutation({
    mutationFn: (id: string) => getReport(id),
    onSuccess: (report) => setReading(report),
  });

  if (reading) return <ReportReader report={reading} onBack={() => setReading(null)} />;

  if (!user?.dateOfBirth) {
    return (
      <Screen>
        <Heading className="mt-4 mb-3">Reports</Heading>
        <Card>
          <Muted>Add your birth details in your profile to generate reports.</Muted>
        </Card>
      </Screen>
    );
  }

  return (
    <Screen>
      <Heading className="mt-4 mb-3">Reports</Heading>

      <View className="flex-row gap-2 mb-4">
        {(['generate', 'history'] as const).map((t) => (
          <Pressable
            key={t}
            testID={`reports-tab-${t}`}
            onPress={() => setTab(t)}
            className={`px-3 py-1.5 rounded-full border ${tab === t ? 'bg-accent-subtle border-accent' : 'bg-surface border-border'}`}
          >
            <Text className={`text-sm capitalize ${tab === t ? 'text-accent' : 'text-fg-muted'}`}>{t}</Text>
          </Pressable>
        ))}
      </View>

      {lockedType ? (
        <Card className="mb-4" testID="reports-locked">
          <Text className="text-fg font-semibold mb-1">Unlock the {lockedType.toLowerCase()} report</Text>
          <Muted className="mb-3">One-time unlock · ₹{pricing.reportPrice}</Muted>
          {buyError ? <Muted className="text-danger mb-2 text-xs">{buyError}</Muted> : null}
          <Button
            testID="reports-unlock"
            title={buying ? 'Opening Play…' : `Unlock for ₹${pricing.reportPrice}`}
            loading={buying}
            onPress={onUnlock}
          />
        </Card>
      ) : null}

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
        {tab === 'generate' ? (
          <View className="flex-row flex-wrap justify-between">
            {REPORT_TYPES.map((r) => {
              const busy = gen.isPending && pendingType === r.type;
              return (
                <Pressable
                  key={r.type}
                  testID={`report-${r.type.toLowerCase()}`}
                  disabled={gen.isPending}
                  onPress={() => gen.mutate(r.type)}
                  className={`w-[48%] mb-3 rounded-2xl bg-surface border border-border p-4 ${gen.isPending && !busy ? 'opacity-50' : ''}`}
                >
                  <Text className="text-2xl mb-2">{r.icon}</Text>
                  <Text className="text-fg font-medium">{r.label}</Text>
                  <Muted className="text-xs mt-0.5">{busy ? 'Generating…' : r.desc}</Muted>
                </Pressable>
              );
            })}
          </View>
        ) : history.isLoading ? (
          <Muted>Loading…</Muted>
        ) : (history.data ?? []).length === 0 ? (
          <Muted>No reports yet.</Muted>
        ) : (
          (history.data as ReportListItem[]).map((r) => (
            <Pressable key={r.id} testID="report-history-item" onPress={() => open.mutate(r.id)}>
              <Card className="mb-2 flex-row items-center justify-between">
                <View>
                  <Text className="text-fg font-medium capitalize">{r.type.toLowerCase()} report</Text>
                  <Muted className="text-xs">{isReportDone(r.status) ? 'Ready' : r.status}</Muted>
                </View>
                <Text className="text-fg-subtle">›</Text>
              </Card>
            </Pressable>
          ))
        )}
      </ScrollView>
    </Screen>
  );
}

function ReportReader({ report, onBack }: { report: ReportResponse; onBack: () => void }) {
  const sections = [...(report.sections ?? [])].sort((a, b) => a.order - b.order);
  return (
    <Screen>
      <View className="flex-row items-center justify-between mt-4 mb-3">
        <Pressable onPress={onBack}>
          <Text className="text-accent">‹ Back</Text>
        </Pressable>
      </View>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
        <Heading className="mb-2">{report.title}</Heading>
        {report.summary ? <Muted className="mb-4">{report.summary}</Muted> : null}
        {sections.map((s, i) => (
          <Card key={i} className="mb-3" testID="report-section">
            <Text className="text-fg font-semibold mb-2">{s.title}</Text>
            <Text className="text-fg-muted leading-6">{s.content}</Text>
          </Card>
        ))}
      </ScrollView>
    </Screen>
  );
}
