/**
 * TanStack Query client + MMKV persistence. Cached reads (My Day, horoscope,
 * kundli) survive relaunch and are readable offline — the mobile mirror of
 * web's `apps/web/src/lib/offline-api.ts` caching layer (plan §9). `ApiError`
 * with a 4xx status is not retried; network/timeout errors are.
 */
import { QueryClient } from '@tanstack/react-query';
import { persistQueryClient } from '@tanstack/react-query-persist-client';
import type { Persister } from '@tanstack/react-query-persist-client';
import { ApiError } from '@myastro360/shared';
import { storage } from '@/lib/mmkv';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 min
      gcTime: 24 * 60 * 60 * 1000, // keep for offline reads for a day
      retry: (failureCount, error) => {
        // Don't retry auth/validation errors; do retry flaky network/timeouts.
        if (error instanceof ApiError && error.status && error.status < 500) return false;
        return failureCount < 2;
      },
    },
  },
});

/** MMKV-backed persister for the query cache. */
const mmkvPersister: Persister = {
  persistClient: async (client) => {
    storage.set('rq-cache', JSON.stringify(client));
  },
  restoreClient: async () => {
    const cached = storage.getString('rq-cache');
    return cached ? JSON.parse(cached) : undefined;
  },
  removeClient: async () => {
    storage.delete('rq-cache');
  },
};

export function initQueryPersistence(): void {
  persistQueryClient({
    queryClient,
    persister: mmkvPersister,
    maxAge: 24 * 60 * 60 * 1000,
  });
}
