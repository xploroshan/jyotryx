import { create } from 'zustand';
import { persist } from 'zustand/middleware';

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
  // True once the persist middleware has finished reading from localStorage.
  // Route gates MUST wait for this before redirecting to /auth, otherwise a
  // hard refresh redirects an authenticated user out of the app in the tiny
  // window before rehydration runs.
  isHydrated: boolean;
  setAuth: (user: User, accessToken: string, refreshToken: string) => void;
  updateCredits: (credits: number) => void;
  setProfileComplete: (complete: boolean) => void;
  updateBirthDetails: (details: BirthDetails & { name?: string }) => void;
  updateAstrologyTraditions: (traditions: string[]) => void;
  updatePrimaryTradition: (tradition: string | null) => void;
  setHydrated: (v: boolean) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      isHydrated: false,
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
      setHydrated: (v) => set({ isHydrated: v }),
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
        set({ user: null, accessToken: null, refreshToken: null, isAuthenticated: false });
      },
    }),
    {
      name: 'jyotron-auth',
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        isAuthenticated: state.isAuthenticated,
      }),
      onRehydrateStorage: () => () => {
        // Fires after the middleware finishes rehydrating from storage.
        // Route gates watch `isHydrated` to avoid redirecting on cold load.
        useAuthStore.getState().setHydrated(true);
      },
    },
  ),
);
