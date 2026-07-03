import { useState } from 'react';
import { View, Text, TextInput, Pressable, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import {
  TRADITION_LIST,
  endpoints,
  type TraditionId,
  type User,
} from '@myastro360/shared';
import { api } from '@/api/client';
import { useAuthStore } from '@/store/auth';
import { Screen, Heading, Muted, Button, Card } from '@/components/ui';

/**
 * Onboarding — birth details + tradition selection. Mirrors web's onboarding:
 * captures a primary tradition + a multi-select of interests, persists via
 * PUT /users/me, and flips profileComplete so the entry gate routes to tabs.
 */
export default function Onboarding() {
  const router = useRouter();
  const { user, updateBirthDetails, updateAstrologyTraditions, updatePrimaryTradition, setProfileComplete } =
    useAuthStore();

  const [dob, setDob] = useState(user?.dateOfBirth ?? '');
  const [tob, setTob] = useState(user?.timeOfBirth ?? '');
  const [pob, setPob] = useState(user?.placeOfBirth ?? '');
  const [selected, setSelected] = useState<TraditionId[]>(
    (user?.astrologyTraditions as TraditionId[]) ?? ['VEDIC'],
  );
  const [primary, setPrimary] = useState<TraditionId>((user?.primaryTradition as TraditionId) ?? 'VEDIC');
  const [saving, setSaving] = useState(false);

  const toggle = (id: TraditionId) =>
    setSelected((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));

  const onContinue = async () => {
    setSaving(true);
    try {
      await api.put<User>(endpoints.user.me, {
        dateOfBirth: dob || null,
        timeOfBirth: tob || null,
        placeOfBirth: pob || null,
        astrologyTraditions: selected,
        primaryTradition: primary,
        profileComplete: true,
      });
      updateBirthDetails({ dateOfBirth: dob, timeOfBirth: tob, placeOfBirth: pob });
      updateAstrologyTraditions(selected);
      updatePrimaryTradition(primary);
      setProfileComplete(true);
      router.replace('/(tabs)');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingVertical: 24 }}>
        <Heading>Welcome ✨</Heading>
        <Muted className="mt-1 mb-5">Tell us about you so your charts are accurate.</Muted>

        <Card className="mb-5">
          <Text className="text-fg font-semibold mb-3">Birth details</Text>
          <Text className="text-fg-muted text-xs mb-1">Date of birth (YYYY-MM-DD)</Text>
          <TextInput
            testID="onboarding-dob"
            value={dob}
            onChangeText={setDob}
            placeholder="1994-05-21"
            placeholderTextColor="#807666"
            className="h-11 rounded-lg border border-border bg-bg px-3 text-fg mb-3"
          />
          <Text className="text-fg-muted text-xs mb-1">Time of birth (HH:MM)</Text>
          <TextInput
            value={tob}
            onChangeText={setTob}
            placeholder="14:30"
            placeholderTextColor="#807666"
            className="h-11 rounded-lg border border-border bg-bg px-3 text-fg mb-3"
          />
          <Text className="text-fg-muted text-xs mb-1">Place of birth</Text>
          <TextInput
            value={pob}
            onChangeText={setPob}
            placeholder="Mumbai, India"
            placeholderTextColor="#807666"
            className="h-11 rounded-lg border border-border bg-bg px-3 text-fg"
          />
        </Card>

        <Card className="mb-5">
          <Text className="text-fg font-semibold mb-1">Traditions you follow</Text>
          <Muted className="mb-3">Tap to select; long-press sets your primary.</Muted>
          <View className="flex-row flex-wrap gap-2">
            {TRADITION_LIST.map((t) => {
              const on = selected.includes(t.id);
              const isPrimary = primary === t.id;
              return (
                <Pressable
                  key={t.id}
                  testID={`onboarding-tradition-${t.slug}`}
                  onPress={() => toggle(t.id)}
                  onLongPress={() => setPrimary(t.id)}
                  className={`px-3 py-2 rounded-full border ${
                    on ? 'bg-accent-subtle border-accent' : 'bg-surface border-border'
                  }`}
                >
                  <Text className={`text-sm ${on ? 'text-accent' : 'text-fg-muted'}`}>
                    {t.icon} {t.slug}
                    {isPrimary ? ' ★' : ''}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </Card>

        <Button
          testID="onboarding-continue"
          title="Continue"
          loading={saving}
          onPress={onContinue}
        />
      </ScrollView>
    </Screen>
  );
}
