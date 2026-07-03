/**
 * Push notifications — registration + tap routing (plan §9).
 *
 * Flow: after sign-in, ask permission → read the native FCM device token
 * (expo-notifications; FCM because the backend sends via firebase-admin) →
 * `POST /users/push-token`. On logout the token is unregistered. Notification
 * taps deep-link via the `url` field in the message data (e.g. `/my-day`,
 * `/feature/horoscope?tradition=VEDIC`) — routes already exist in expo-router.
 *
 * Everything here is best-effort: push never blocks the app, and all native
 * calls are guarded for environments without the modules (Expo Go, tests).
 */
import { Platform } from 'react-native';
import { endpoints } from '@myastro360/shared';
import { api } from '@/api/client';
import { storage } from '@/lib/mmkv';

const REGISTERED_KEY = 'push.registeredToken';

type NotificationsModule = typeof import('expo-notifications');

function loadNotifications(): NotificationsModule | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require('expo-notifications') as NotificationsModule;
  } catch {
    return null;
  }
}

/** Ask permission and return the native FCM device token, or null. */
async function getDeviceToken(): Promise<string | null> {
  const Notifications = loadNotifications();
  if (!Notifications) return null;
  try {
    const existing = await Notifications.getPermissionsAsync();
    let granted = existing.granted;
    if (!granted && existing.canAskAgain) {
      granted = (await Notifications.requestPermissionsAsync()).granted;
    }
    if (!granted) return null;

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'General',
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }
    const { data } = await Notifications.getDevicePushTokenAsync();
    return typeof data === 'string' ? data : null;
  } catch {
    return null;
  }
}

/**
 * Register the device for push after sign-in. Skips the network round-trip if
 * this exact token is already registered (MMKV-remembered).
 */
export async function registerForPush(): Promise<boolean> {
  const token = await getDeviceToken();
  if (!token) return false;
  if (storage.getString(REGISTERED_KEY) === token) return true;
  try {
    await api.post(endpoints.user.pushToken, { token, platform: Platform.OS });
    storage.set(REGISTERED_KEY, token);
    return true;
  } catch {
    return false; // retried on next launch
  }
}

/** Unregister on logout so a shared device stops getting personal pushes. */
export async function unregisterPush(): Promise<void> {
  const token = storage.getString(REGISTERED_KEY);
  storage.delete(REGISTERED_KEY);
  if (!token) return;
  try {
    await api.post(endpoints.user.pushTokenDelete, { token });
  } catch {
    // Best-effort: the backend also prunes tokens FCM reports invalid.
  }
}

/**
 * Route a notification tap to its screen. The backend puts a router path in
 * `data.url` (falls back to My Day). Returns the path for the caller to push.
 */
export function pathFromNotificationData(data: Record<string, unknown> | null | undefined): string {
  const url = data?.url;
  if (typeof url === 'string' && url.startsWith('/')) return url;
  return '/(tabs)';
}

/** Wire the tap listener; returns an unsubscribe. */
export function listenForNotificationTaps(navigate: (path: string) => void): () => void {
  const Notifications = loadNotifications();
  if (!Notifications) return () => {};
  const sub = Notifications.addNotificationResponseReceivedListener((response) => {
    const data = response.notification.request.content.data as Record<string, unknown>;
    navigate(pathFromNotificationData(data));
  });
  // A cold-start tap arrives via the last response, not the listener.
  Notifications.getLastNotificationResponseAsync?.().then((response) => {
    if (response) {
      const data = response.notification.request.content.data as Record<string, unknown>;
      navigate(pathFromNotificationData(data));
    }
  });
  return () => sub.remove();
}
