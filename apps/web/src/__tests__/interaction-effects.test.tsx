/**
 * Interaction-effect tests — "dead wiring guard".
 *
 * The now-removed FocusMode toggle on /my-day was a textbook case: the
 * button rendered, looked clickable, and on click wrote to a store that
 * nothing read. No test caught it because every test was a render
 * assertion ("does text X appear?") instead of a behaviour assertion
 * ("click X → observable state Y changes").
 *
 * The tests here aren't exhaustive; they establish the pattern and cover
 * the highest-traffic interactive controls on the auth + palmistry
 * pages. Extend as new toggles are added.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';

// ─── Common mocks ───────────────────────────────────────────────────────────
const mockPush = vi.fn();
const mockReplace = vi.fn();
const mockSearchParams = new URLSearchParams();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace }),
  useSearchParams: () => mockSearchParams,
  usePathname: () => '/auth',
}));

vi.mock('@/lib/firebase', () => ({
  auth: {},
  RecaptchaVerifier: vi.fn(),
  signInWithPhoneNumber: vi.fn(),
  GoogleAuthProvider: vi.fn(),
  signInWithPopup: vi.fn(),
  sendPasswordResetEmail: vi.fn(),
  signInWithEmailAndPassword: vi.fn(),
}));

vi.mock('@/lib/api', () => ({
  api: { post: vi.fn(), get: vi.fn(), put: vi.fn(), upload: vi.fn() },
  wakeUpBackend: vi.fn().mockResolvedValue(undefined),
  ApiError: class ApiError extends Error {},
}));

const mockAuth = {
  user: null,
  accessToken: null,
  refreshToken: null,
  isAuthenticated: false,
  setAuth: vi.fn(),
  setProfileComplete: vi.fn(),
  updateCredits: vi.fn(),
  updateBirthDetails: vi.fn(),
  updateAstrologyTraditions: vi.fn(),
  updatePrimaryTradition: vi.fn(),
  logout: vi.fn(),
};
vi.mock('@/lib/store', () => ({
  useAuthStore: Object.assign(
    vi.fn((selector?: any) =>
      typeof selector === 'function' ? selector(mockAuth) : mockAuth,
    ),
    { getState: () => mockAuth },
  ),
  useAuthHydrated: () => true,
}));

async function importAuthPage() {
  const mod = await import('@/app/auth/page');
  return mod.default;
}

describe('Auth password show/hide toggle is wired', () => {
  beforeEach(() => vi.clearAllMocks());

  it('toggles input[type] between password and text', async () => {
    const AuthPage = await importAuthPage();
    render(<AuthPage />);

    // Switch to email method so the password field appears.
    fireEvent.click(screen.getByRole('tab', { name: /email/i }));

    const pw = screen.getByLabelText(/password/i) as HTMLInputElement;
    expect(pw.type).toBe('password');

    const showBtn = screen.getAllByRole('button', { name: /show/i })[0];
    fireEvent.click(showBtn);
    expect(pw.type).toBe('text');

    // Toggle button's label and aria-pressed reflect the new state.
    const hideBtn = screen.getAllByRole('button', { name: /hide/i })[0];
    expect(hideBtn.getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(hideBtn);
    expect(pw.type).toBe('password');
  });
});

describe('Auth method tab switch is wired', () => {
  beforeEach(() => vi.clearAllMocks());

  it('swaps phone form for email form and back', async () => {
    const AuthPage = await importAuthPage();
    render(<AuthPage />);

    // Phone method is the default; phone input visible.
    expect(screen.getByLabelText(/phone number/i)).toBeDefined();

    fireEvent.click(screen.getByRole('tab', { name: /^email$/i }));
    expect(screen.queryByLabelText(/phone number/i)).toBeNull();
    expect(screen.getByLabelText(/^email$/i)).toBeDefined();

    fireEvent.click(screen.getByRole('tab', { name: /phone/i }));
    expect(screen.getByLabelText(/phone number/i)).toBeDefined();
  });
});

describe('Auth login/signup tab switch is wired', () => {
  beforeEach(() => vi.clearAllMocks());

  it('exposes the Full Name field only in signup', async () => {
    const AuthPage = await importAuthPage();
    render(<AuthPage />);

    expect(screen.queryByLabelText(/full name/i)).toBeNull();
    fireEvent.click(screen.getByRole('tab', { name: /sign up/i }));
    expect(screen.getByLabelText(/full name/i)).toBeDefined();
    fireEvent.click(screen.getByRole('tab', { name: /log in/i }));
    expect(screen.queryByLabelText(/full name/i)).toBeNull();
  });
});
