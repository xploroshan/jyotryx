import { useEffect, useState } from 'react';
import { View, Text } from 'react-native';
import { onlineManager } from '@tanstack/react-query';

type NetworkModule = typeof import('expo-network');

function loadNetwork(): NetworkModule | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require('expo-network') as NetworkModule;
  } catch {
    return null;
  }
}

/**
 * Offline affordance (plan §9): a slim banner when connectivity drops, and the
 * bridge that tells TanStack Query to pause/resume fetching. Cached reads (My
 * Day, horoscope, kundli) keep working from the MMKV-persisted cache.
 */
export function OfflineBanner() {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    const Network = loadNetwork();
    if (!Network) return;

    const apply = (connected: boolean) => {
      setOffline(!connected);
      onlineManager.setOnline(connected);
    };

    Network.getNetworkStateAsync()
      .then((s) => apply(s.isConnected !== false))
      .catch(() => {});

    const sub = Network.addNetworkStateListener?.((s) => apply(s.isConnected !== false));
    return () => sub?.remove();
  }, []);

  if (!offline) return null;
  return (
    <View testID="offline-banner" className="bg-warning px-4 py-1.5">
      <Text className="text-white text-xs text-center font-medium">
        You're offline — showing saved readings
      </Text>
    </View>
  );
}
