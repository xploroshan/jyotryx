/**
 * Auth E2E Flow Tests
 *
 * Tests the full auth flows: email login, email signup, phone OTP login,
 * Google sign-in, forgot password, change password, and validation errors.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';

// Auth page checks this env var to decide between Firebase phone auth and the
// backend OTP fallback. These tests cover the Firebase path, so force it on.
process.env.NEXT_PUBLIC_FIREBASE_API_KEY = 'test-api-key';

// ─── Mock next/navigation ───────────────────────────────────────────────────
const mockPush = vi.fn();
const mockReplace = vi.fn();
const mockGet = vi.fn().mockReturnValue(null);
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace }),
  usePathname: () => '/',
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
const mockApiGet = vi.fn();
vi.mock('@/lib/api', () => ({
  api: {
    get: (...args: any[]) => mockApiGet(...args),
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

// ─── Mock Logo ──────────────────────────────────────────────────────────────
vi.mock('@/components/ui/Logo', () => ({
  LogoMark: ({ className }: any) => <div data-testid="logo-mark" className={className} />,
  Wordmark: ({ className }: any) => <span className={className}>MyAstro360</span>,
  Logo: ({ className }: any) => <span className={className}>MyAstro360</span>,
}));

// ─── Mock Firebase ──────────────────────────────────────────────────────────
const mockSignInWithPhoneNumber = vi.fn();
const mockSignInWithPopup = vi.fn();
const mockSendPasswordResetEmail = vi.fn();
// RecaptchaVerifier is mocked as a class in vi.mock below

vi.mock('@/lib/firebase', () => ({
  auth: {},
  RecaptchaVerifier: class MockRecaptchaVerifier {
    clear() {}
  },
  signInWithPhoneNumber: (...args: any[]) => mockSignInWithPhoneNumber(...args),
  GoogleAuthProvider: vi.fn(),
  signInWithPopup: (...args: any[]) => mockSignInWithPopup(...args),
  sendPasswordResetEmail: (...args: any[]) => mockSendPasswordResetEmail(...args),
  // Firebase email/password fallback. Tests don't exercise a working
  // Firebase path, so we always reject — the auth page then surfaces the
  // original backend error message.
  signInWithEmailAndPassword: vi.fn(() => Promise.reject(new Error('firebase-disabled'))),
}));

function resetAllMocks() {
  mockPush.mockReset();
  mockReplace.mockReset();
  mockGet.mockReturnValue(null);
  mockApiPost.mockReset();
  // The auth page's forgot-password handler fires api.post('/auth/forgot-password',…)
  // as a best-effort hint in parallel with Firebase's sendPasswordResetEmail and
  // attaches a `.catch` to suppress failures. Default the mock to a resolved
  // promise so `.catch()` doesn't explode on `undefined`. Individual tests can
  // still override with mockResolvedValueOnce / mockRejectedValueOnce.
  mockApiPost.mockResolvedValue({});
  mockApiGet.mockReset();
  mockApiGet.mockResolvedValue({});
  mockSignInWithPhoneNumber.mockReset();
  mockSignInWithPopup.mockReset();
  mockSendPasswordResetEmail.mockReset();
  mockStoreState.setAuth.mockReset();
  mockStoreState.logout.mockReset();
  mockStoreState.isAuthenticated = false;
  mockStoreState.user = null;
  mockStoreState.accessToken = null;
}

// ─── Import components AFTER mocks ──────────────────────────────────────────
import AuthPage from '@/app/auth/page';

// Helper: switch to email auth method
function switchToEmail() {
  fireEvent.click(screen.getByText('Email'));
}

// Helper: fill email and password fields
function fillEmailForm(email: string, password: string) {
  fireEvent.change(screen.getByPlaceholderText('you@example.com'), { target: { value: email } });
  fireEvent.change(screen.getByPlaceholderText('Min 8 characters'), { target: { value: password } });
}

// Helper: click the submit button (last "Log in" or "Create Account")
function clickSubmit(label: string) {
  const buttons = screen.getAllByText(label);
  fireEvent.click(buttons[buttons.length - 1]);
}

describe('Auth Flow: Email Login', () => {
  beforeEach(() => {
    resetAllMocks();
  });

  it('should login successfully with email and password', async () => {
    const mockUser = { id: '1', name: 'Test User', email: 'test@test.com', profileComplete: true };
    const mockTokens = { accessToken: 'at-123', refreshToken: 'rt-456' };
    mockApiPost.mockResolvedValueOnce({ user: mockUser, tokens: mockTokens });

    render(<AuthPage />);
    switchToEmail();
    fillEmailForm('test@test.com', 'password123');
    clickSubmit('Log in');

    await waitFor(() => {
      expect(mockApiPost).toHaveBeenCalledWith(
        '/auth/login',
        { email: 'test@test.com', password: 'password123' },
        expect.anything(),
      );
    });
    expect(mockStoreState.setAuth).toHaveBeenCalledWith(mockUser, 'at-123', 'rt-456');
    expect(mockPush).toHaveBeenCalledWith('/my-day');
  });

  it('should show error on invalid credentials', async () => {
    mockApiPost.mockRejectedValueOnce(new Error('Invalid email or password'));

    render(<AuthPage />);
    switchToEmail();
    fillEmailForm('wrong@test.com', 'wrongpassword');
    clickSubmit('Log in');

    expect(await screen.findByText('Invalid email or password')).toBeDefined();
    expect(mockStoreState.setAuth).not.toHaveBeenCalled();
    expect(mockPush).not.toHaveBeenCalledWith('/my-day');
  });

  it('should show validation error for empty email', async () => {
    render(<AuthPage />);
    switchToEmail();
    fireEvent.change(screen.getByPlaceholderText('Min 8 characters'), { target: { value: 'password123' } });
    clickSubmit('Log in');

    expect(await screen.findByText('Please enter your email')).toBeDefined();
    expect(mockApiPost).not.toHaveBeenCalled();
  });

  it('should show validation error for short password', async () => {
    render(<AuthPage />);
    switchToEmail();
    fillEmailForm('test@test.com', 'short');
    clickSubmit('Log in');

    expect(await screen.findByText('Password must be at least 8 characters')).toBeDefined();
    expect(mockApiPost).not.toHaveBeenCalled();
  });

  it('should show "Please wait..." while loading', async () => {
    // Never-resolving promise to keep loading state
    mockApiPost.mockReturnValueOnce(new Promise(() => {}));

    render(<AuthPage />);
    switchToEmail();
    fillEmailForm('test@test.com', 'password123');
    clickSubmit('Log in');

    expect(await screen.findByText('Please wait...')).toBeDefined();
  });
});

describe('Auth Flow: Email Signup', () => {
  beforeEach(() => {
    resetAllMocks();
  });

  it('should signup successfully with name, email and password', async () => {
    const mockUser = { id: '2', name: 'New User', email: 'new@test.com', profileComplete: true };
    const mockTokens = { accessToken: 'at-new', refreshToken: 'rt-new' };
    mockApiPost.mockResolvedValueOnce({ user: mockUser, tokens: mockTokens });

    render(<AuthPage />);
    fireEvent.click(screen.getByText('Sign up'));
    switchToEmail();

    fireEvent.change(screen.getByPlaceholderText('Enter your name'), { target: { value: 'New User' } });
    fillEmailForm('new@test.com', 'SecurePass123');
    clickSubmit('Create Account');

    await waitFor(() => {
      expect(mockApiPost).toHaveBeenCalledWith(
        '/auth/register',
        {
          name: 'New User',
          email: 'new@test.com',
          password: 'SecurePass123',
        },
        expect.anything(),
      );
    });
    expect(mockStoreState.setAuth).toHaveBeenCalledWith(mockUser, 'at-new', 'rt-new');
    expect(mockPush).toHaveBeenCalledWith('/my-day');
  });

  it('should show validation error when name is missing on signup', async () => {
    render(<AuthPage />);
    fireEvent.click(screen.getByText('Sign up'));
    switchToEmail();

    fillEmailForm('new@test.com', 'SecurePass123');
    clickSubmit('Create Account');

    expect(await screen.findByText('Please enter your name')).toBeDefined();
    expect(mockApiPost).not.toHaveBeenCalled();
  });

  it('should show API error on duplicate email', async () => {
    mockApiPost.mockRejectedValueOnce(new Error('Email already registered'));

    render(<AuthPage />);
    fireEvent.click(screen.getByText('Sign up'));
    switchToEmail();

    fireEvent.change(screen.getByPlaceholderText('Enter your name'), { target: { value: 'Existing' } });
    fillEmailForm('existing@test.com', 'SecurePass123');
    clickSubmit('Create Account');

    expect(await screen.findByText('Email already registered')).toBeDefined();
  });

  it('should show password strength indicator during signup', () => {
    render(<AuthPage />);
    fireEvent.click(screen.getByText('Sign up'));
    switchToEmail();

    fireEvent.change(screen.getByPlaceholderText('Min 8 characters'), { target: { value: 'weak' } });
    expect(screen.getByText('Weak')).toBeDefined();

    fireEvent.change(screen.getByPlaceholderText('Min 8 characters'), { target: { value: 'StrongPass1!' } });
    expect(screen.getByText('Very Strong')).toBeDefined();
  });
});

describe('Auth Flow: Phone OTP Login', () => {
  beforeEach(() => {
    resetAllMocks();
  });

  it('should send OTP and show verification input', async () => {
    const mockConfirmation = {
      confirm: vi.fn().mockResolvedValue({
        user: { getIdToken: () => Promise.resolve('firebase-token-123') },
      }),
    };
    mockSignInWithPhoneNumber.mockResolvedValueOnce(mockConfirmation);

    render(<AuthPage />);
    // Phone is default method
    fireEvent.change(screen.getByPlaceholderText('Phone number'), { target: { value: '9876543210' } });
    fireEvent.click(screen.getByText('Send OTP'));

    await waitFor(() => {
      expect(mockSignInWithPhoneNumber).toHaveBeenCalled();
    });

    // OTP sent — verify input appears
    expect(await screen.findByText('OTP sent successfully! Check your phone.')).toBeDefined();
    expect(screen.getByPlaceholderText('6-digit OTP')).toBeDefined();
    expect(screen.getByText('Verify & Continue')).toBeDefined();
  });

  it('should verify OTP and authenticate with backend', async () => {
    const mockUser = { id: '3', name: 'Phone User', email: '', profileComplete: true };
    const mockTokens = { accessToken: 'at-phone', refreshToken: 'rt-phone' };
    mockApiPost.mockResolvedValueOnce({ user: mockUser, tokens: mockTokens });

    const mockConfirmation = {
      confirm: vi.fn().mockResolvedValue({
        user: { getIdToken: () => Promise.resolve('firebase-id-token') },
      }),
    };
    mockSignInWithPhoneNumber.mockResolvedValueOnce(mockConfirmation);

    render(<AuthPage />);
    fireEvent.change(screen.getByPlaceholderText('Phone number'), { target: { value: '9876543210' } });
    fireEvent.click(screen.getByText('Send OTP'));

    // Wait for OTP sent
    await screen.findByText('Verify & Continue');

    // Enter OTP and verify
    fireEvent.change(screen.getByPlaceholderText('6-digit OTP'), { target: { value: '123456' } });
    fireEvent.click(screen.getByText('Verify & Continue'));

    await waitFor(() => {
      expect(mockConfirmation.confirm).toHaveBeenCalledWith('123456');
    });
    await waitFor(() => {
      expect(mockApiPost).toHaveBeenCalledWith(
        '/auth/firebase',
        { idToken: 'firebase-id-token' },
        expect.anything(),
      );
    });
    expect(mockStoreState.setAuth).toHaveBeenCalledWith(mockUser, 'at-phone', 'rt-phone');
    expect(mockPush).toHaveBeenCalledWith('/my-day');
  });

  it('should show error for invalid OTP', async () => {
    const mockConfirmation = {
      confirm: vi.fn().mockRejectedValue({ code: 'auth/invalid-verification-code' }),
    };
    mockSignInWithPhoneNumber.mockResolvedValueOnce(mockConfirmation);

    render(<AuthPage />);
    fireEvent.change(screen.getByPlaceholderText('Phone number'), { target: { value: '9876543210' } });
    fireEvent.click(screen.getByText('Send OTP'));

    await screen.findByText('Verify & Continue');

    fireEvent.change(screen.getByPlaceholderText('6-digit OTP'), { target: { value: '000000' } });
    fireEvent.click(screen.getByText('Verify & Continue'));

    expect(await screen.findByText('Invalid OTP. Please check and try again.')).toBeDefined();
  });

  it('should show error for expired OTP', async () => {
    const mockConfirmation = {
      confirm: vi.fn().mockRejectedValue({ code: 'auth/code-expired' }),
    };
    mockSignInWithPhoneNumber.mockResolvedValueOnce(mockConfirmation);

    render(<AuthPage />);
    fireEvent.change(screen.getByPlaceholderText('Phone number'), { target: { value: '9876543210' } });
    fireEvent.click(screen.getByText('Send OTP'));

    await screen.findByText('Verify & Continue');

    fireEvent.change(screen.getByPlaceholderText('6-digit OTP'), { target: { value: '111111' } });
    fireEvent.click(screen.getByText('Verify & Continue'));

    expect(await screen.findByText('OTP has expired. Please request a new one.')).toBeDefined();
  });

  it('should validate phone number length before sending OTP', async () => {
    render(<AuthPage />);
    fireEvent.change(screen.getByPlaceholderText('Phone number'), { target: { value: '12345' } });
    fireEvent.click(screen.getByText('Send OTP'));

    expect(await screen.findByText('Please enter a valid 10-digit phone number')).toBeDefined();
    expect(mockSignInWithPhoneNumber).not.toHaveBeenCalled();
  });

  it('should show error on too many OTP requests', async () => {
    mockSignInWithPhoneNumber.mockRejectedValueOnce({ code: 'auth/too-many-requests' });

    render(<AuthPage />);
    fireEvent.change(screen.getByPlaceholderText('Phone number'), { target: { value: '9876543210' } });
    fireEvent.click(screen.getByText('Send OTP'));

    expect(await screen.findByText('Too many attempts. Please try again later.')).toBeDefined();
  });

  it('falls back to the backend OTP flow when Firebase phone auth has no billing', async () => {
    // Firebase Phone Auth requires the Blaze plan; a project without billing
    // throws auth/billing-not-enabled. The backend OTP path uses its own SMS
    // provider, so the app should transparently fall back rather than show
    // the raw Firebase error.
    mockSignInWithPhoneNumber.mockRejectedValueOnce({ code: 'auth/billing-not-enabled' });
    mockApiPost.mockResolvedValueOnce({ message: 'sent', expiresIn: 300 });

    render(<AuthPage />);
    fireEvent.change(screen.getByPlaceholderText('Phone number'), { target: { value: '9876543210' } });
    fireEvent.click(screen.getByText('Send OTP'));

    // Backend send was hit, and the user lands on the verify step — no raw
    // "Firebase: Error (auth/billing-not-enabled)" leaks to the UI.
    await waitFor(() => {
      expect(mockApiPost).toHaveBeenCalledWith(
        '/auth/otp/send',
        { phone: '+919876543210' },
        expect.anything(),
      );
    });
    expect(await screen.findByText('Verify & Continue')).toBeDefined();
    expect(screen.queryByText(/billing-not-enabled/)).toBeNull();
  });

  it('should show resend OTP and change number options after OTP sent', async () => {
    const mockConfirmation = { confirm: vi.fn() };
    mockSignInWithPhoneNumber.mockResolvedValueOnce(mockConfirmation);

    render(<AuthPage />);
    fireEvent.change(screen.getByPlaceholderText('Phone number'), { target: { value: '9876543210' } });
    fireEvent.click(screen.getByText('Send OTP'));

    expect(await screen.findByText('Verify & Continue')).toBeDefined();
    expect(screen.getByText('Resend OTP')).toBeDefined();
    expect(screen.getByText('Change Number')).toBeDefined();
  });
});

describe('Auth Flow: Google Sign-In', () => {
  beforeEach(() => {
    resetAllMocks();
  });

  it('should authenticate with Google successfully', async () => {
    const mockUser = { id: '4', name: 'Google User', email: 'google@test.com', profileComplete: true };
    const mockTokens = { accessToken: 'at-google', refreshToken: 'rt-google' };

    mockSignInWithPopup.mockResolvedValueOnce({
      user: { getIdToken: () => Promise.resolve('google-firebase-token') },
    });
    mockApiPost.mockResolvedValueOnce({ user: mockUser, tokens: mockTokens });

    render(<AuthPage />);
    fireEvent.click(screen.getByText('Continue with Google'));

    await waitFor(() => {
      expect(mockApiPost).toHaveBeenCalledWith(
        '/auth/firebase',
        { idToken: 'google-firebase-token' },
        expect.anything(),
      );
    });
    await waitFor(() => {
      expect(mockStoreState.setAuth).toHaveBeenCalledWith(mockUser, 'at-google', 'rt-google');
    });
    expect(mockPush).toHaveBeenCalledWith('/my-day');
  });

  it('should not show error when user closes Google popup', async () => {
    mockSignInWithPopup.mockRejectedValueOnce({ code: 'auth/popup-closed-by-user' });

    render(<AuthPage />);
    fireEvent.click(screen.getByText('Continue with Google'));

    // Wait a tick for async handling
    await waitFor(() => {
      expect(mockSignInWithPopup).toHaveBeenCalled();
    });

    // No error should be shown for popup-closed
    const errorElements = document.querySelectorAll('.text-red-400');
    expect(errorElements.length).toBe(0);
  });

  it('should show error when popup is blocked', async () => {
    mockSignInWithPopup.mockRejectedValueOnce({ code: 'auth/popup-blocked' });

    render(<AuthPage />);
    fireEvent.click(screen.getByText('Continue with Google'));

    expect(await screen.findByText('Popup was blocked by your browser. Please allow popups and try again.')).toBeDefined();
  });

  it('should show "Signing in..." while Google auth is in progress', async () => {
    mockSignInWithPopup.mockReturnValueOnce(new Promise(() => {}));

    render(<AuthPage />);
    fireEvent.click(screen.getByText('Continue with Google'));

    expect(await screen.findByText('Signing in...')).toBeDefined();
  });
});

describe('Auth Flow: Forgot Password', () => {
  beforeEach(() => {
    resetAllMocks();
  });

  it('should navigate to forgot password view and send reset email', async () => {
    mockSendPasswordResetEmail.mockResolvedValueOnce(undefined);

    render(<AuthPage />);
    switchToEmail();

    // Click forgot password link
    fireEvent.click(screen.getByText('Forgot password?'));

    // Should show reset password form
    expect(screen.getByText('Reset Password')).toBeDefined();
    expect(screen.getByText('Send Reset Link')).toBeDefined();

    // Fill email and submit
    fireEvent.change(screen.getByPlaceholderText('you@example.com'), { target: { value: 'reset@test.com' } });
    fireEvent.click(screen.getByText('Send Reset Link'));

    await waitFor(() => {
      expect(mockSendPasswordResetEmail).toHaveBeenCalledWith({}, 'reset@test.com');
    });
    expect(await screen.findByText('Password reset email sent! Check your inbox.')).toBeDefined();
  });

  it('should show error for non-existent email', async () => {
    mockSendPasswordResetEmail.mockRejectedValueOnce({ code: 'auth/user-not-found' });

    render(<AuthPage />);
    switchToEmail();
    fireEvent.click(screen.getByText('Forgot password?'));

    fireEvent.change(screen.getByPlaceholderText('you@example.com'), { target: { value: 'nonexistent@test.com' } });
    fireEvent.click(screen.getByText('Send Reset Link'));

    expect(await screen.findByText('No account found with this email address.')).toBeDefined();
  });

  it('should show error for invalid email format', async () => {
    mockSendPasswordResetEmail.mockRejectedValueOnce({ code: 'auth/invalid-email' });

    render(<AuthPage />);
    switchToEmail();
    fireEvent.click(screen.getByText('Forgot password?'));

    fireEvent.change(screen.getByPlaceholderText('you@example.com'), { target: { value: 'not-an-email' } });
    fireEvent.click(screen.getByText('Send Reset Link'));

    expect(await screen.findByText('Please enter a valid email address.')).toBeDefined();
  });

  it('should show validation error when email is empty', async () => {
    render(<AuthPage />);
    switchToEmail();
    fireEvent.click(screen.getByText('Forgot password?'));

    fireEvent.click(screen.getByText('Send Reset Link'));

    expect(await screen.findByText('Please enter your email address')).toBeDefined();
    expect(mockSendPasswordResetEmail).not.toHaveBeenCalled();
  });

  it('should navigate back to login from forgot password', () => {
    render(<AuthPage />);
    switchToEmail();
    fireEvent.click(screen.getByText('Forgot password?'));

    expect(screen.getByText('Reset Password')).toBeDefined();

    fireEvent.click(screen.getByText('Back to login'));

    // Should be back on login view — check that tabs are visible
    expect(screen.getByText('Sign up')).toBeDefined();
    expect(screen.getByText('Continue with Google')).toBeDefined();
  });

  it('should pre-fill reset email from login email field', () => {
    render(<AuthPage />);
    switchToEmail();

    // Type email in login form
    fireEvent.change(screen.getByPlaceholderText('you@example.com'), { target: { value: 'prefill@test.com' } });

    // Navigate to forgot password
    fireEvent.click(screen.getByText('Forgot password?'));

    // The reset email input should be pre-filled
    const emailInput = screen.getByPlaceholderText('you@example.com') as HTMLInputElement;
    expect(emailInput.value).toBe('prefill@test.com');
  });

  it('should show rate limit error on too many reset attempts', async () => {
    mockSendPasswordResetEmail.mockRejectedValueOnce({ code: 'auth/too-many-requests' });

    render(<AuthPage />);
    switchToEmail();
    fireEvent.click(screen.getByText('Forgot password?'));

    fireEvent.change(screen.getByPlaceholderText('you@example.com'), { target: { value: 'spam@test.com' } });
    fireEvent.click(screen.getByText('Send Reset Link'));

    expect(await screen.findByText('Too many requests. Please try again later.')).toBeDefined();
  });
});

describe('Auth Flow: Authenticated Redirect', () => {
  beforeEach(() => {
    resetAllMocks();
  });

  it('should redirect authenticated user with complete profile to /my-day', () => {
    mockStoreState.isAuthenticated = true;
    mockStoreState.user = { id: '1', name: 'Test', email: 't@t.com', profileComplete: true };
    render(<AuthPage />);
    expect(mockReplace).toHaveBeenCalledWith('/my-day');
  });

  it('should redirect authenticated user with incomplete profile to /profile', () => {
    mockStoreState.isAuthenticated = true;
    mockStoreState.user = { id: '1', name: 'Test', email: 't@t.com', profileComplete: false };
    render(<AuthPage />);
    expect(mockReplace).toHaveBeenCalledWith('/profile');
  });

  it('should open signup tab when mode=signup query param is set', () => {
    mockStoreState.isAuthenticated = false;
    mockGet.mockReturnValue('signup');
    render(<AuthPage />);

    // The "Sign up" tab should be active (has bg-primary-600)
    // And "Create Account" button should be visible when email method is selected
    switchToEmail();
    expect(screen.getByText('Create Account')).toBeDefined();
  });
});
