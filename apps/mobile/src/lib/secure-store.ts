/**
 * Token storage backed by expo-secure-store (Android Keystore / iOS Keychain).
 * This is the mobile analogue of web's localStorage-persisted auth store, but
 * the refresh/access tokens live in the OS secure enclave rather than JS-
 * readable storage. Non-sensitive state (active tradition, locale) persists via
 * MMKV/AsyncStorage instead.
 */
import * as SecureStore from 'expo-secure-store';

const ACCESS_KEY = 'myastro360.accessToken';
const REFRESH_KEY = 'myastro360.refreshToken';

export async function getStoredTokens(): Promise<{
  accessToken: string | null;
  refreshToken: string | null;
}> {
  const [accessToken, refreshToken] = await Promise.all([
    SecureStore.getItemAsync(ACCESS_KEY),
    SecureStore.getItemAsync(REFRESH_KEY),
  ]);
  return { accessToken, refreshToken };
}

export async function setStoredTokens(accessToken: string, refreshToken: string): Promise<void> {
  await Promise.all([
    SecureStore.setItemAsync(ACCESS_KEY, accessToken),
    SecureStore.setItemAsync(REFRESH_KEY, refreshToken),
  ]);
}

export async function clearStoredTokens(): Promise<void> {
  await Promise.all([
    SecureStore.deleteItemAsync(ACCESS_KEY),
    SecureStore.deleteItemAsync(REFRESH_KEY),
  ]);
}
