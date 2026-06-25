/**
 * Auth Page Rendering Tests
 *
 * Validates the auth page renders login/signup forms correctly,
 * handles method switching, and shows appropriate error states.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';

// ─── Mock next/navigation ───────────────────────────────────────────────────
const mockPush = vi.fn();
const mockReplace = vi.fn();
const mockGet = vi.fn().mockReturnValue(null);
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace }),
  useSearchParams: () => ({ get: mockGet }),
}));

// ─── Mock store ─────────────────────────────────────────────────────────────
const mockStoreState: Record<string, any> = {
  user: null,
  accessToken: null,
  refreshToken: null,
  isAuthenticated: false,
  setAuth: vi.fn(),
  updateCredits: vi.fn(),
  setProfileComplete: vi.fn(),
  logout: vi.fn(),
};

vi.mock('@/lib/store', () => ({
  useAuthStore: Object.assign(
    vi.fn((selector?: any) => selector ? selector(mockStoreState) : mockStoreState),
    { getState: () => mockStoreState },
  ),
  useAuthHydrated: () => true,
}));

// ─── Mock API ───────────────────────────────────────────────────────────────
const mockApiPost = vi.fn();
vi.mock('@/lib/api', () => ({
  api: {
    get: vi.fn(),
    post: (...args: any[]) => mockApiPost(...args),
    put: vi.fn(),
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
  auth: {},
  RecaptchaVerifier: vi.fn(),
  signInWithPhoneNumber: vi.fn(),
  GoogleAuthProvider: vi.fn(),
  signInWithPopup: vi.fn(),
  sendPasswordResetEmail: vi.fn(),
  signInWithEmailAndPassword: vi.fn(() => Promise.reject(new Error('firebase-disabled'))),
}));

// ─── Import component AFTER mocks ───────────────────────────────────────────
import AuthPage from '@/app/auth/page';

describe('Auth Page: Rendering', () => {
  beforeEach(() => {
    mockPush.mockReset();
    mockReplace.mockReset();
    mockGet.mockReturnValue(null);
    mockApiPost.mockReset();
    mockStoreState.isAuthenticated = false;
    mockStoreState.setAuth.mockReset();
  });

  it('should render login and signup tabs', () => {
    render(<AuthPage />);
    // Query the tabs by role — robust against the page also carrying an
    // sr-only <h1> with the same "Log in" label for a11y/SEO.
    expect(screen.getByRole('tab', { name: 'Log in' })).toBeDefined();
    expect(screen.getByRole('tab', { name: 'Sign up' })).toBeDefined();
  });

  it('should render Google sign-in button', () => {
    render(<AuthPage />);
    expect(screen.getByText('Continue with Google')).toBeDefined();
  });

  it('should render phone and email method toggles', () => {
    render(<AuthPage />);
    expect(screen.getByText('Phone (OTP)')).toBeDefined();
    expect(screen.getByText('Email')).toBeDefined();
  });

  it('should render phone input by default', () => {
    const { container } = render(<AuthPage />);
    expect(screen.getByText('+91')).toBeDefined();
    expect(screen.getByPlaceholderText('Phone number')).toBeDefined();
    expect(screen.getByText('Send OTP')).toBeDefined();
  });

  it('should render email/password inputs when email method selected', () => {
    render(<AuthPage />);
    fireEvent.click(screen.getByText('Email'));
    expect(screen.getByPlaceholderText('you@example.com')).toBeDefined();
    expect(screen.getByPlaceholderText('Min 8 characters')).toBeDefined();
    // "Log in" appears in tab and submit button
    const loginElements = screen.getAllByText('Log in');
    expect(loginElements.length).toBeGreaterThanOrEqual(2);
  });

  it('should show name field in signup mode with email', () => {
    render(<AuthPage />);
    fireEvent.click(screen.getByText('Sign up'));
    fireEvent.click(screen.getByText('Email'));
    expect(screen.getByPlaceholderText('Enter your name')).toBeDefined();
  });

  it('should show forgot password link in login mode with email', () => {
    render(<AuthPage />);
    fireEvent.click(screen.getByText('Email'));
    expect(screen.getByText('Forgot password?')).toBeDefined();
  });

  it('should render terms of service text', () => {
    render(<AuthPage />);
    expect(screen.getByText(/Terms of Service/)).toBeDefined();
  });

  it('should redirect to /my-day when already authenticated with complete profile', () => {
    mockStoreState.isAuthenticated = true;
    (mockStoreState as any).user = { id: '1', name: 'Test', email: 'test@test.com', credits: 10, role: 'user', profileComplete: true };
    render(<AuthPage />);
    expect(mockReplace).toHaveBeenCalledWith('/my-day');
    mockStoreState.isAuthenticated = false;
    (mockStoreState as any).user = null;
  });

  it('should redirect to /profile when authenticated but profile incomplete', () => {
    mockStoreState.isAuthenticated = true;
    (mockStoreState as any).user = { id: '1', name: 'Test', email: 'test@test.com', credits: 10, role: 'user', profileComplete: false };
    render(<AuthPage />);
    expect(mockReplace).toHaveBeenCalledWith('/profile');
    mockStoreState.isAuthenticated = false;
    (mockStoreState as any).user = null;
  });

  it('should show email login error on API failure', async () => {
    mockApiPost.mockRejectedValueOnce(new Error('Invalid credentials'));
    render(<AuthPage />);
    fireEvent.click(screen.getByText('Email'));
    fireEvent.change(screen.getByPlaceholderText('you@example.com'), { target: { value: 'test@test.com' } });
    fireEvent.change(screen.getByPlaceholderText('Min 8 characters'), { target: { value: 'password123' } });

    // Find the submit button — in email login mode it's the last "Log in" button in the form
    const buttons = screen.getAllByText('Log in');
    const submitBtn = buttons[buttons.length - 1];
    fireEvent.click(submitBtn);

    expect(await screen.findByText('Invalid credentials')).toBeDefined();
  });
});
