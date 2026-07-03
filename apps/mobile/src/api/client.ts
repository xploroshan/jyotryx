/**
 * Mobile API client — the shared `createApiClient` factory wired to this app's
 * token storage. The adapter reads the in-memory tokens from the auth store
 * (kept in sync with SecureStore), persists rotated tokens after a refresh, and
 * logs the user out when the session is unrecoverable. All endpoint paths come
 * from `@myastro360/shared`'s verified `endpoints` map.
 */
import Constants from 'expo-constants';
import { createApiClient, endpoints } from '@myastro360/shared';
import { useAuthStore } from '@/store/auth';

const apiUrl =
  (Constants.expoConfig?.extra?.apiUrl as string | undefined) ??
  process.env.EXPO_PUBLIC_API_URL ??
  'https://api.myastro360.com/api';

export const api = createApiClient({
  baseUrl: apiUrl,
  getTokens: () => {
    const { accessToken, refreshToken } = useAuthStore.getState();
    return { accessToken, refreshToken };
  },
  onTokensRefreshed: async ({ accessToken, refreshToken }) => {
    await useAuthStore.getState().applyRefreshedTokens(accessToken, refreshToken);
  },
  onAuthCleared: async () => {
    await useAuthStore.getState().logout();
  },
});

export { endpoints };
