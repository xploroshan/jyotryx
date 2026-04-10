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
  profileComplete: boolean;
}

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  setAuth: (user: User, accessToken: string, refreshToken: string) => void;
  updateCredits: (credits: number) => void;
  setProfileComplete: (complete: boolean) => void;
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
    },
  ),
);
