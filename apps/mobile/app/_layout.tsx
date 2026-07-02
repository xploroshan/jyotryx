import '../global.css';

import { useEffect, useRef, useState } from 'react';
import { InteractionManager } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider, DefaultTheme, type Theme } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { QueryClientProvider } from '@tanstack/react-query';
import * as SplashScreen from 'expo-splash-screen';

import { queryClient, initQueryPersistence } from '@/api/queryClient';
import { useAuthStore } from '@/store/auth';
import { initSentry } from '@/lib/sentry';
import { registerForPush, listenForNotificationTaps } from '@/notifications/push';
import { OfflineBanner } from '@/components/OfflineBanner';
import { colors } from '@/theme';

// Build the navigation theme from DefaultTheme so it carries the required
// `fonts` map (React Navigation v7), then paint our Warm Linen palette over it.
const navigationTheme: Theme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: colors.accent,
    background: colors.bg,
    card: colors.surface,
    text: colors.fg,
    border: colors.border,
    notification: colors.accent,
  },
};

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const router = useRouter();
  const hydrateTokens = useAuthStore((s) => s.hydrateTokens);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const [ready, setReady] = useState(false);
  const deferredDone = useRef(false);

  useEffect(() => {
    // Read tokens back from SecureStore before we decide auth routing, then
    // reveal the app. Keeps authenticated users from flashing the sign-in
    // screen on cold start (the mobile analogue of web's useAuthHydrated gate).
    (async () => {
      await hydrateTokens();
      setReady(true);
      await SplashScreen.hideAsync().catch(() => {});
    })();
  }, [hydrateTokens]);

  // Startup budget (§6): nothing non-essential before first paint. Sentry,
  // query-cache persistence, and the notification tap listener start only
  // after interactions settle.
  useEffect(() => {
    if (!ready || deferredDone.current) return;
    deferredDone.current = true;
    const task = InteractionManager.runAfterInteractions(() => {
      initSentry();
      initQueryPersistence();
      listenForNotificationTaps((path) => router.push(path as never));
    });
    return () => task.cancel();
  }, [ready, router]);

  // Register the device for push once signed in (best-effort, deferred).
  useEffect(() => {
    if (!ready || !isAuthenticated) return;
    const task = InteractionManager.runAfterInteractions(() => {
      registerForPush();
    });
    return () => task.cancel();
  }, [ready, isAuthenticated]);

  if (!ready) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <ThemeProvider value={navigationTheme}>
            <StatusBar style="dark" />
            <OfflineBanner />
            <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
              <Stack.Screen name="index" />
              <Stack.Screen name="(auth)" />
              <Stack.Screen name="(tabs)" />
              <Stack.Screen name="tradition/[slug]" options={{ headerShown: true, title: '' }} />
              <Stack.Screen name="feature/[slug]" options={{ headerShown: true, title: '' }} />
              <Stack.Screen name="match/[token]" options={{ headerShown: true, title: '' }} />
              <Stack.Screen name="pricing" options={{ headerShown: true, title: '' }} />
            </Stack>
          </ThemeProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
