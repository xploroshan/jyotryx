import { View, Text, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '@/store/auth';
import { useI18nStore } from '@/store/i18n';
import { Screen, Heading, Muted, Card, Button } from '@/components/ui';
import { MemorySection } from '@/profile/MemorySection';

/**
 * Profile — account, credits, language, and the account actions. Referral,
 * daily-briefing preferences, and password change hang off here in P1
 * (GET /referral/me, GET/PUT /briefing/preferences, POST /auth/change-password).
 */
export default function Profile() {
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const { locale } = useI18nStore();

  const onLogout = async () => {
    await logout();
    router.replace('/(auth)/sign-in');
  };

  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingVertical: 16 }}>
        <Heading className="mb-4">Profile</Heading>

        <Card className="mb-4">
          <Text className="text-fg text-lg font-semibold">{user?.name ?? 'Guest'}</Text>
          <Muted className="mt-1">{user?.email ?? ''}</Muted>
          <View className="flex-row justify-between mt-4">
            <View>
              <Muted>Credits</Muted>
              <Text className="text-accent font-bold text-lg" testID="profile-credits">
                {user?.credits ?? 0}
              </Text>
            </View>
            <View>
              <Muted>Primary tradition</Muted>
              <Text className="text-fg font-medium">{user?.primaryTradition ?? 'VEDIC'}</Text>
            </View>
            <View>
              <Muted>Language</Muted>
              <Text className="text-fg font-medium uppercase">{locale}</Text>
            </View>
          </View>
        </Card>

        <View className="mb-4">
          <MemorySection />
        </View>

        <Card className="mb-4">
          <Muted>Referral, briefing preferences, and password change wire up in P1.</Muted>
        </Card>

        <Button testID="profile-logout" title="Log out" variant="secondary" onPress={onLogout} />
      </ScrollView>
    </Screen>
  );
}
