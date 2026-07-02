import { Redirect } from 'expo-router';
import { useAuthStore } from '@/store/auth';

/**
 * Entry gate. Routes on the hydrated auth state — same decision tree as web:
 *  - not signed in            → auth stack
 *  - signed in, profile incomplete → onboarding (birth details + tradition)
 *  - signed in, complete      → app tabs
 */
export default function Index() {
  const { isAuthenticated, user, hydrated } = useAuthStore();

  if (!hydrated) return null; // splash still showing

  if (!isAuthenticated) return <Redirect href="/(auth)/sign-in" />;
  if (user && !user.profileComplete) return <Redirect href="/(auth)/onboarding" />;
  return <Redirect href="/(tabs)" />;
}
