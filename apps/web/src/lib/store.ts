import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { useEffect, useState } from 'react';

interface User {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  credits: number;
  role: string;
  preferredLanguage?: string;
  astrologyTraditions: string[];
  primaryTradition?: string | null;
  profileComplete: boolean;
  dateOfBirth?: string | null;
  timeOfBirth?: string | null;
  placeOfBirth?: string | null;
  gender?: string | null;
}

interface BirthDetails {
  dateOfBirth?: string | null;
  timeOfBirth?: string | null;
  placeOfBirth?: string | null;
  gender?: string | null;
}

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  setAuth: (user: User, accessToken: string, refreshToken: string) => void;
  updateCredits: (credits: number) => void;
  setProfileComplete: (complete: boolean) => void;
  updateBirthDetails: (details: BirthDetails & { name?: string }) => void;
  updateAstrologyTraditions: (traditions: string[]) => void;
  updatePrimaryTradition: (tradition: string | null) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      setAuth: (user, accessToken, refreshToken) =>
        set({ user, accessToken, refreshToken, isAuthenticated: true }),
      updateCredits: (credits) =>
        set((state) => ({
          user: state.user ? { ...state.user, credits } : null,
        })),
      setProfileComplete: (complete) =>
        set((state) => ({
          user: state.user ? { ...state.user, profileComplete: complete } : null,
        })),
      updateBirthDetails: (details) =>
        set((state) => ({
          user: state.user
            ? {
                ...state.user,
                ...(details.name !== undefined && { name: details.name || state.user.name }),
                ...(details.dateOfBirth !== undefined && { dateOfBirth: details.dateOfBirth }),
                ...(details.timeOfBirth !== undefined && { timeOfBirth: details.timeOfBirth }),
                ...(details.placeOfBirth !== undefined && { placeOfBirth: details.placeOfBirth }),
                ...(details.gender !== undefined && { gender: details.gender }),
              }
            : null,
        })),
      updateAstrologyTraditions: (traditions) =>
        set((state) => ({
          user: state.user ? { ...state.user, astrologyTraditions: traditions } : null,
        })),
      updatePrimaryTradition: (tradition) =>
        set((state) => ({
          user: state.user ? { ...state.user, primaryTradition: tradition } : null,
        })),
      logout: () => {
        // Sign out of Firebase client SDK too
        import('@/lib/firebase').then(({ auth }) => {
          auth.signOut().catch(() => {});
        });
        // Reset the locale preference so the next user starts from their
        // system default instead of the previous user's chosen language.
        import('@/i18n').then(({ useI18nStore }) => {
          try { useI18nStore.getState().resetLocale(); } catch {}
        });
        // Drop any per-user cached data so the next account on this device
        // doesn't see the previous user's briefing.
        try {
          if (typeof window !== 'undefined') {
            window.localStorage.removeItem('myastro360-my-day-briefing');
          }
        } catch { /* quota / private mode */ }
        set({ user: null, accessToken: null, refreshToken: null, isAuthenticated: false });
      },
    }),
    {
      name: 'myastro360-auth',
    },
  ),
);

/**
 * Returns `true` once Zustand's persist middleware has finished reading
 * the auth store from localStorage. On the server and during the initial
 * client render this is `false` — callers must wait for it before using
 * `isAuthenticated` to decide on redirects, otherwise authenticated users
 * get bounced to /auth on every hard refresh.
 *
 * We deliberately don't stash this flag inside the store itself: Zustand
 * v5's `onRehydrateStorage` callback fires synchronously during `create()`
 * when storage is synchronous (as localStorage is), at a point where the
 * store reference isn't yet initialised — so setting state from inside
 * that callback throws and silently leaves the flag stuck at `false`.
 * `persist.hasHydrated()` + `onFinishHydration()` is the documented,
 * race-free API.
 */
export function useAuthHydrated(): boolean {
  // Always start `false` so SSR and the initial client render agree —
  // toggling to `true` only inside `useEffect` avoids a React hydration
  // mismatch warning on the <body>'s text content.
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    if (useAuthStore.persist.hasHydrated()) {
      setHydrated(true);
      return;
    }
    const unsub = useAuthStore.persist.onFinishHydration(() => setHydrated(true));
    return unsub;
  }, []);
  return hydrated;
}
