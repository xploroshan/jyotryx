/**
 * Auth store — mobile analogue of `apps/web/src/lib/store.ts`. Same User shape
 * (imported from @myastro360/shared) and the same action surface, but:
 *  - tokens live in expo-secure-store (OS enclave), mirrored in-memory here
 *    for synchronous access by the api-client adapter;
 *  - non-sensitive profile + activeTradition persist via MMKV.
 */
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { User, BirthDetails } from '@myastro360/shared';
import { zustandMMKVStorage } from '@/lib/mmkv';
import {
  getStoredTokens,
  setStoredTokens,
  clearStoredTokens,
} from '@/lib/secure-store';

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  /** True once tokens have been read back from SecureStore on boot. */
  hydrated: boolean;
  activeTradition: string | null;

  hydrateTokens: () => Promise<void>;
  setAuth: (user: User, accessToken: string, refreshToken: string) => Promise<void>;
  /** Called by the api-client after a successful /auth/refresh. */
  applyRefreshedTokens: (accessToken: string, refreshToken: string) => Promise<void>;
  updateCredits: (credits: number) => void;
  setProfileComplete: (complete: boolean) => void;
  updateBirthDetails: (details: BirthDetails & { name?: string; nickname?: string | null }) => void;
  updateAstrologyTraditions: (traditions: string[]) => void;
  updatePrimaryTradition: (tradition: string | null) => void;
  setActiveTradition: (tradition: string | null) => void;
  logout: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      hydrated: false,
      activeTradition: null,

      hydrateTokens: async () => {
        const { accessToken, refreshToken } = await getStoredTokens();
        set({
          accessToken,
          refreshToken,
          isAuthenticated: !!accessToken && !!get().user,
          hydrated: true,
        });
      },

      setAuth: async (user, accessToken, refreshToken) => {
        await setStoredTokens(accessToken, refreshToken);
        set({ user, accessToken, refreshToken, isAuthenticated: true });
      },

      applyRefreshedTokens: async (accessToken, refreshToken) => {
        await setStoredTokens(accessToken, refreshToken);
        set({ accessToken, refreshToken });
      },

      updateCredits: (credits) =>
        set((s) => ({ user: s.user ? { ...s.user, credits } : null })),

      setProfileComplete: (complete) =>
        set((s) => ({ user: s.user ? { ...s.user, profileComplete: complete } : null })),

      updateBirthDetails: (details) =>
        set((s) => ({
          user: s.user
            ? {
                ...s.user,
                ...(details.name !== undefined && { name: details.name || s.user.name }),
                ...(details.nickname !== undefined && { nickname: details.nickname }),
                ...(details.dateOfBirth !== undefined && { dateOfBirth: details.dateOfBirth }),
                ...(details.timeOfBirth !== undefined && { timeOfBirth: details.timeOfBirth }),
                ...(details.placeOfBirth !== undefined && { placeOfBirth: details.placeOfBirth }),
                ...(details.gender !== undefined && { gender: details.gender }),
              }
            : null,
        })),

      updateAstrologyTraditions: (traditions) =>
        set((s) => ({ user: s.user ? { ...s.user, astrologyTraditions: traditions } : null })),

      updatePrimaryTradition: (tradition) =>
        set((s) => ({ user: s.user ? { ...s.user, primaryTradition: tradition } : null })),

      setActiveTradition: (tradition) => set({ activeTradition: tradition }),

      logout: async () => {
        await clearStoredTokens();
        set({
          user: null,
          accessToken: null,
          refreshToken: null,
          isAuthenticated: false,
          activeTradition: null,
        });
      },
    }),
    {
      name: 'myastro360-auth',
      storage: createJSONStorage(() => zustandMMKVStorage),
      // Tokens are never persisted by Zustand — they live in SecureStore.
      partialize: (state) => ({
        user: state.user,
        activeTradition: state.activeTradition,
      }),
    },
  ),
);
