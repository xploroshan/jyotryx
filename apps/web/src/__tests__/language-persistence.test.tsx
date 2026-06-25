/**
 * Language Persistence Tests
 *
 * Verifies the full lifecycle of the user's language preference:
 *
 * 1. System language is detected from `navigator.language` on first visit.
 * 2. Once the user explicitly selects a locale, it persists across reloads.
 * 3. Anonymous users can change language on the auth page.
 * 4. When an authenticated user switches language, the choice is pushed to
 *    `PUT /users/me` so the backend can restore it on the next login.
 * 5. Logging out resets the locale back to the detected system default so a
 *    new user on the same device starts fresh.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import React from 'react';

// ─── Mock next/navigation ───────────────────────────────────────────────────
const mockPush = vi.fn();
const mockReplace = vi.fn();
const mockGet = vi.fn().mockReturnValue(null);
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace }),
  useSearchParams: () => ({ get: mockGet }),
}));

// ─── Mock API (track PUT calls) ─────────────────────────────────────────────
const mockApiPut = vi.fn();
const mockApiPost = vi.fn();
vi.mock('@/lib/api', () => ({
  api: {
    get: vi.fn(),
    post: (...args: any[]) => mockApiPost(...args),
    put: (...args: any[]) => mockApiPut(...args),
    delete: vi.fn(),
    upload: vi.fn(),
  },
  wakeUpBackend: vi.fn().mockResolvedValue(true),
  ApiError: class ApiError extends Error {
    status: number | null = null;
    isTimeout = false;
    isNetwork = false;
    constructor(message: string, opts: any = {}) {
      super(message);
      this.name = 'ApiError';
      this.status = opts.status ?? null;
      this.isTimeout = opts.isTimeout ?? false;
      this.isNetwork = opts.isNetwork ?? false;
    }
  },
}));

// ─── Mock Logo component ────────────────────────────────────────────────────
vi.mock('@/components/ui/Logo', () => ({
  LogoMark: ({ className }: any) => <div data-testid="logo-mark" className={className} />,
  Wordmark: ({ className }: any) => <span className={className}>MyAstro360</span>,
  Logo: ({ className }: any) => <span className={className}>MyAstro360</span>,
}));

// ─── Mock Firebase ──────────────────────────────────────────────────────────
vi.mock('@/lib/firebase', () => ({
  auth: { signOut: vi.fn().mockResolvedValue(undefined) },
  RecaptchaVerifier: vi.fn(),
  signInWithPhoneNumber: vi.fn(),
  GoogleAuthProvider: vi.fn(),
  signInWithPopup: vi.fn(),
  sendPasswordResetEmail: vi.fn(),
  signInWithEmailAndPassword: vi.fn(),
}));

// ─── Auth-store mock: lets individual tests flip isAuthenticated ────────────
const mockAuthStoreState: Record<string, any> = {
  user: null,
  accessToken: null,
  refreshToken: null,
  isAuthenticated: false,
  setAuth: vi.fn((user, at, rt) => {
    mockAuthStoreState.user = user;
    mockAuthStoreState.accessToken = at;
    mockAuthStoreState.refreshToken = rt;
    mockAuthStoreState.isAuthenticated = true;
  }),
  updateCredits: vi.fn(),
  setProfileComplete: vi.fn(),
  logout: vi.fn(),
};
vi.mock('@/lib/store', () => ({
  useAuthStore: Object.assign(
    vi.fn((selector?: any) => selector ? selector(mockAuthStoreState) : mockAuthStoreState),
    { getState: () => mockAuthStoreState },
  ),
  useAuthHydrated: () => true,
}));

// ─── Imports after mocks ────────────────────────────────────────────────────
import LanguageSwitcher from '@/components/ui/LanguageSwitcher';
import { useI18nStore, detectSystemLocale } from '@/i18n';
import AuthPage from '@/app/auth/page';

// Helper: reset Zustand store between tests
function resetI18nStore(initialLocale: string = 'en') {
  act(() => {
    useI18nStore.setState({ locale: initialLocale as any, userSet: false });
  });
}

describe('Language persistence: system language detection', () => {
  const originalNavigator = global.navigator;

  afterEach(() => {
    Object.defineProperty(global, 'navigator', {
      value: originalNavigator,
      configurable: true,
    });
  });

  it('detects a supported Indian language from navigator.language', () => {
    Object.defineProperty(global, 'navigator', {
      value: { language: 'hi-IN', languages: ['hi-IN', 'en-US'] },
      configurable: true,
    });
    expect(detectSystemLocale()).toBe('hi');
  });

  it('falls back to English when the system language is not supported', () => {
    Object.defineProperty(global, 'navigator', {
      value: { language: 'fr-FR', languages: ['fr-FR'] },
      configurable: true,
    });
    expect(detectSystemLocale()).toBe('en');
  });

  it('maps Tamil (ta-IN) to ta', () => {
    Object.defineProperty(global, 'navigator', {
      value: { language: 'ta-IN', languages: ['ta-IN'] },
      configurable: true,
    });
    expect(detectSystemLocale()).toBe('ta');
  });

  it('prefers navigator.languages[0] when it is supported', () => {
    Object.defineProperty(global, 'navigator', {
      value: { language: 'en-US', languages: ['bn-IN', 'en-US'] },
      configurable: true,
    });
    expect(detectSystemLocale()).toBe('bn');
  });
});

describe('Language persistence: LanguageSwitcher', () => {
  beforeEach(() => {
    mockApiPut.mockReset();
    mockAuthStoreState.isAuthenticated = false;
    mockAuthStoreState.user = null;
    resetI18nStore('en');
  });

  it('updates the i18n store and marks it as user-set when a language is clicked', () => {
    render(<LanguageSwitcher />);
    fireEvent.click(screen.getByRole('button'));
    fireEvent.click(screen.getByText('हिन्दी'));
    const state = useI18nStore.getState();
    expect(state.locale).toBe('hi');
    expect(state.userSet).toBe(true);
  });

  it('does NOT call PUT /users/me when the user is anonymous', () => {
    render(<LanguageSwitcher />);
    fireEvent.click(screen.getByRole('button'));
    fireEvent.click(screen.getByText('தமிழ்'));
    expect(mockApiPut).not.toHaveBeenCalled();
  });

  it('calls PUT /users/me with preferredLanguage when the user is authenticated', () => {
    mockAuthStoreState.isAuthenticated = true;
    mockAuthStoreState.user = { id: '1', name: 'Test', email: 't@t.com', credits: 5, role: 'USER', profileComplete: true };
    mockApiPut.mockResolvedValue({});
    render(<LanguageSwitcher />);
    fireEvent.click(screen.getByRole('button'));
    fireEvent.click(screen.getByText('বাংলা'));
    expect(mockApiPut).toHaveBeenCalledWith('/users/me', { preferredLanguage: 'bn' });
  });

  it('silently ignores PUT /users/me errors (UI still updates)', () => {
    mockAuthStoreState.isAuthenticated = true;
    mockAuthStoreState.user = { id: '1', name: 'Test', email: 't@t.com', credits: 5, role: 'USER', profileComplete: true };
    mockApiPut.mockRejectedValue(new Error('network down'));
    render(<LanguageSwitcher />);
    fireEvent.click(screen.getByRole('button'));
    fireEvent.click(screen.getByText('मराठी'));
    expect(useI18nStore.getState().locale).toBe('mr');
  });
});

describe('Language persistence: auth page', () => {
  beforeEach(() => {
    mockPush.mockReset();
    mockReplace.mockReset();
    mockGet.mockReturnValue(null);
    mockApiPost.mockReset();
    mockApiPut.mockReset();
    mockAuthStoreState.isAuthenticated = false;
    mockAuthStoreState.user = null;
    resetI18nStore('en');
  });

  it('renders a LanguageSwitcher so anonymous users can change language', () => {
    render(<AuthPage />);
    // There should be at least one "English" label in the LanguageSwitcher
    // dropdown (after opening it).
    const buttons = screen.getAllByRole('button');
    // Open the globe button (it contains the "EN" label)
    const globeBtn = buttons.find((b) => b.textContent?.includes('EN'));
    expect(globeBtn).toBeDefined();
    fireEvent.click(globeBtn!);
    expect(screen.getByText('हिन्दी')).toBeDefined();
  });

  it('anonymous language selection persists to the i18n store', () => {
    render(<AuthPage />);
    const buttons = screen.getAllByRole('button');
    const globeBtn = buttons.find((b) => b.textContent?.includes('EN'))!;
    fireEvent.click(globeBtn);
    fireEvent.click(screen.getByText('తెలుగు'));
    expect(useI18nStore.getState().locale).toBe('te');
    expect(useI18nStore.getState().userSet).toBe(true);
  });

  it('applies user.preferredLanguage from the login response', async () => {
    mockApiPost.mockResolvedValueOnce({
      user: {
        id: '1', name: 'Test', email: 't@t.com', credits: 5, role: 'USER',
        profileComplete: true, preferredLanguage: 'gu',
      },
      tokens: { accessToken: 'at', refreshToken: 'rt' },
    });
    render(<AuthPage />);
    fireEvent.click(screen.getByText('Email'));
    fireEvent.change(screen.getByPlaceholderText('you@example.com'), { target: { value: 't@t.com' } });
    fireEvent.change(screen.getByPlaceholderText('Min 8 characters'), { target: { value: 'password123' } });
    const loginButtons = screen.getAllByText('Log in');
    fireEvent.click(loginButtons[loginButtons.length - 1]);
    // Wait a tick for the async login flow
    await act(async () => { await Promise.resolve(); });
    expect(useI18nStore.getState().locale).toBe('gu');
  });

  it('ignores unknown preferredLanguage values from the server', async () => {
    // Start with a known locale (en) so UI labels are in English.
    resetI18nStore('en');
    mockApiPost.mockResolvedValueOnce({
      user: {
        id: '1', name: 'Test', email: 't@t.com', credits: 5, role: 'USER',
        profileComplete: true, preferredLanguage: 'xx',
      },
      tokens: { accessToken: 'at', refreshToken: 'rt' },
    });
    render(<AuthPage />);
    fireEvent.click(screen.getByText('Email'));
    fireEvent.change(screen.getByPlaceholderText('you@example.com'), { target: { value: 't@t.com' } });
    fireEvent.change(screen.getByPlaceholderText('Min 8 characters'), { target: { value: 'password123' } });
    const loginButtons = screen.getAllByText('Log in');
    fireEvent.click(loginButtons[loginButtons.length - 1]);
    await act(async () => { await Promise.resolve(); });
    // Locale should be unchanged (the unknown 'xx' value is ignored)
    expect(useI18nStore.getState().locale).toBe('en');
  });
});

describe('Language persistence: store-level reset', () => {
  beforeEach(() => {
    resetI18nStore('en');
  });

  it('resetLocale() reverts to the system default and clears userSet', () => {
    Object.defineProperty(global, 'navigator', {
      value: { language: 'kn-IN', languages: ['kn-IN'] },
      configurable: true,
    });
    act(() => {
      useI18nStore.setState({ locale: 'hi', userSet: true });
      useI18nStore.getState().resetLocale();
    });
    const state = useI18nStore.getState();
    expect(state.locale).toBe('kn');
    expect(state.userSet).toBe(false);
  });

  it('setLocale() with explicit userSet=false does NOT mark as user-chosen', () => {
    // This guards against the sync-from-login path accidentally locking in a
    // server value as a user choice. (Our code passes userSet: true, but a
    // future refactor might not — this test documents the contract.)
    act(() => {
      useI18nStore.getState().setLocale('ta', { userSet: false });
    });
    expect(useI18nStore.getState().locale).toBe('ta');
    expect(useI18nStore.getState().userSet).toBe(false);
  });
});
