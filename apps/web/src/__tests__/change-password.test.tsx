/**
 * Change Password E2E Flow Tests
 *
 * Tests the full change password and set password flows from the profile
 * security tab, including validation, API calls, and success/error states.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';

// ─── Mock next/navigation ───────────────────────────────────────────────────
const mockPush = vi.fn();
const mockReplace = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace }),
  useSearchParams: () => new URLSearchParams(),
}));

// ─── Mock store ─────────────────────────────────────────────────────────────
const mockStoreState: Record<string, any> = {
  user: { id: '1', name: 'Test User', email: 'test@test.com', credits: 10, role: 'user', profileComplete: true },
  accessToken: 'valid-token',
  refreshToken: 'valid-refresh',
  isAuthenticated: true,
  isHydrated: true,
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
}));

// ─── Mock data ──────────────────────────────────────────────────────────────
const mockProfile = {
  id: '1', name: 'Test User', email: 'test@test.com', phone: '+919876543210',
  dateOfBirth: '1990-05-15', timeOfBirth: '10:30', placeOfBirth: 'Mumbai',
  gender: 'Male', profession: 'SOFTWARE', profilePhoto: null,
  credits: 10, role: 'user', createdAt: '2025-01-01T00:00:00Z',
  profileComplete: true,
};
const mockCredits = { available: 10, used: 5, total: 15, role: 'user', resetsAt: '2026-05-01' };

// ─── Import component AFTER mocks ──────────────────────────────────────────
import ProfilePage from '@/app/profile/page';

// ─── Helpers ────────────────────────────────────────────────────────────────
function setupApiMocks(hasPassword = true) {
  mockApiGet.mockImplementation((url: string) => {
    if (url === '/users/me') return Promise.resolve(mockProfile);
    if (url === '/users/me/credits') return Promise.resolve(mockCredits);
    if (url === '/auth/status') return Promise.resolve({ hasPassword });
    if (url === '/memory') return Promise.resolve([]);
    return Promise.resolve({});
  });
}

async function navigateToSecurityTab() {
  await screen.findByText('Test User');
  const securityBtn = screen.getAllByText('Security')[0];
  fireEvent.click(securityBtn);
  await waitFor(() => {
    expect(document.body.textContent).toContain('New Password');
  });
}

describe('Change Password Flow (existing password)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStoreState.isAuthenticated = true;
    mockStoreState.accessToken = 'valid-token';
    setupApiMocks(true);
  });

  it('should show "Change Password" heading when user has a password', async () => {
    render(<ProfilePage />);
    await navigateToSecurityTab();

    const changePasswordElements = screen.getAllByText('Change Password');
    expect(changePasswordElements.length).toBeGreaterThanOrEqual(1);
  });

  it('should show current password field when user has a password', async () => {
    render(<ProfilePage />);
    await navigateToSecurityTab();

    expect(screen.getByPlaceholderText('Enter current password')).toBeDefined();
  });

  it('should successfully change password', async () => {
    mockApiPost.mockResolvedValueOnce({ message: 'Password changed successfully' });

    render(<ProfilePage />);
    await navigateToSecurityTab();

    fireEvent.change(screen.getByPlaceholderText('Enter current password'), { target: { value: 'OldPass123!' } });
    fireEvent.change(screen.getByPlaceholderText('Min 8 chars, upper + lower + number'), { target: { value: 'NewPass456!' } });
    fireEvent.change(screen.getByPlaceholderText('Re-enter new password'), { target: { value: 'NewPass456!' } });

    // Click the Change Password submit button
    const changeButtons = screen.getAllByText('Change Password');
    const submitBtn = changeButtons[changeButtons.length - 1];
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(mockApiPost).toHaveBeenCalledWith(
        '/auth/change-password',
        { currentPassword: 'OldPass123!', newPassword: 'NewPass456!' },
        // The change-password call opts out of the 401 auto-refresh so a
        // wrong current password surfaces as an error instead of logging
        // the user out (see api.ts skipAuthRefreshOn401).
        expect.objectContaining({ token: 'valid-token', skipAuthRefreshOn401: true }),
      );
    });
    expect(await screen.findByText('Password changed successfully')).toBeDefined();
  });

  it('should show error when current password is missing', async () => {
    render(<ProfilePage />);
    await navigateToSecurityTab();

    fireEvent.change(screen.getByPlaceholderText('Min 8 chars, upper + lower + number'), { target: { value: 'NewPass456!' } });
    fireEvent.change(screen.getByPlaceholderText('Re-enter new password'), { target: { value: 'NewPass456!' } });

    const changeButtons = screen.getAllByText('Change Password');
    fireEvent.click(changeButtons[changeButtons.length - 1]);

    expect(await screen.findByText('Please enter your current password')).toBeDefined();
    expect(mockApiPost).not.toHaveBeenCalled();
  });

  it('should show error when new password is too short', async () => {
    render(<ProfilePage />);
    await navigateToSecurityTab();

    fireEvent.change(screen.getByPlaceholderText('Enter current password'), { target: { value: 'OldPass123!' } });
    fireEvent.change(screen.getByPlaceholderText('Min 8 chars, upper + lower + number'), { target: { value: 'short' } });
    fireEvent.change(screen.getByPlaceholderText('Re-enter new password'), { target: { value: 'short' } });

    const changeButtons = screen.getAllByText('Change Password');
    fireEvent.click(changeButtons[changeButtons.length - 1]);

    expect(await screen.findByText('New password must be at least 8 characters')).toBeDefined();
    expect(mockApiPost).not.toHaveBeenCalled();
  });

  it('should show error when passwords do not match', async () => {
    render(<ProfilePage />);
    await navigateToSecurityTab();

    fireEvent.change(screen.getByPlaceholderText('Enter current password'), { target: { value: 'OldPass123!' } });
    fireEvent.change(screen.getByPlaceholderText('Min 8 chars, upper + lower + number'), { target: { value: 'NewPass456!' } });
    fireEvent.change(screen.getByPlaceholderText('Re-enter new password'), { target: { value: 'DifferentPass!' } });

    const changeButtons = screen.getAllByText('Change Password');
    fireEvent.click(changeButtons[changeButtons.length - 1]);

    expect(await screen.findByText('New passwords do not match')).toBeDefined();
    expect(mockApiPost).not.toHaveBeenCalled();
  });

  it('should show error when new password is same as current', async () => {
    render(<ProfilePage />);
    await navigateToSecurityTab();

    fireEvent.change(screen.getByPlaceholderText('Enter current password'), { target: { value: 'SamePass123!' } });
    fireEvent.change(screen.getByPlaceholderText('Min 8 chars, upper + lower + number'), { target: { value: 'SamePass123!' } });
    fireEvent.change(screen.getByPlaceholderText('Re-enter new password'), { target: { value: 'SamePass123!' } });

    const changeButtons = screen.getAllByText('Change Password');
    fireEvent.click(changeButtons[changeButtons.length - 1]);

    expect(await screen.findByText('New password must be different from current password')).toBeDefined();
    expect(mockApiPost).not.toHaveBeenCalled();
  });

  it('should show API error on incorrect current password', async () => {
    mockApiPost.mockRejectedValueOnce(new Error('Current password is incorrect'));

    render(<ProfilePage />);
    await navigateToSecurityTab();

    fireEvent.change(screen.getByPlaceholderText('Enter current password'), { target: { value: 'WrongPass!' } });
    fireEvent.change(screen.getByPlaceholderText('Min 8 chars, upper + lower + number'), { target: { value: 'NewPass456!' } });
    fireEvent.change(screen.getByPlaceholderText('Re-enter new password'), { target: { value: 'NewPass456!' } });

    const changeButtons = screen.getAllByText('Change Password');
    fireEvent.click(changeButtons[changeButtons.length - 1]);

    expect(await screen.findByText('Current password is incorrect')).toBeDefined();
  });

  it('should show password strength indicator', async () => {
    render(<ProfilePage />);
    await navigateToSecurityTab();

    fireEvent.change(screen.getByPlaceholderText('Min 8 chars, upper + lower + number'), { target: { value: 'weak' } });
    expect(screen.getByText('Weak')).toBeDefined();

    fireEvent.change(screen.getByPlaceholderText('Min 8 chars, upper + lower + number'), { target: { value: 'StrongP1!' } });
    expect(screen.getByText('Very Strong')).toBeDefined();
  });

  it('should show inline mismatch warning when confirm password differs', async () => {
    render(<ProfilePage />);
    await navigateToSecurityTab();

    fireEvent.change(screen.getByPlaceholderText('Min 8 chars, upper + lower + number'), { target: { value: 'NewPass456!' } });
    fireEvent.change(screen.getByPlaceholderText('Re-enter new password'), { target: { value: 'Diff' } });

    expect(screen.getByText('Passwords do not match')).toBeDefined();
  });
});

describe('Set Password Flow (OTP/social users)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStoreState.isAuthenticated = true;
    mockStoreState.accessToken = 'valid-token';
    setupApiMocks(false); // hasPassword = false
  });

  it('should show "Set Password" heading when user has no password', async () => {
    render(<ProfilePage />);
    await navigateToSecurityTab();

    const setPasswordElements = screen.getAllByText('Set Password');
    expect(setPasswordElements.length).toBeGreaterThanOrEqual(1);
  });

  it('should NOT show current password field for OTP/social users', async () => {
    render(<ProfilePage />);
    await navigateToSecurityTab();

    const currentPasswordInput = document.querySelector('input[placeholder="Enter current password"]');
    expect(currentPasswordInput).toBeNull();
  });

  it('should successfully set a new password', async () => {
    mockApiPost.mockResolvedValueOnce({ message: 'Password set successfully' });

    render(<ProfilePage />);
    await navigateToSecurityTab();

    fireEvent.change(screen.getByPlaceholderText('Min 8 chars, upper + lower + number'), { target: { value: 'MyNewPass1!' } });
    fireEvent.change(screen.getByPlaceholderText('Re-enter new password'), { target: { value: 'MyNewPass1!' } });

    const setButtons = screen.getAllByText('Set Password');
    fireEvent.click(setButtons[setButtons.length - 1]);

    await waitFor(() => {
      expect(mockApiPost).toHaveBeenCalledWith(
        '/auth/set-password',
        { password: 'MyNewPass1!' },
        { token: 'valid-token' },
      );
    });
    expect(await screen.findByText('Password set successfully')).toBeDefined();
  });

  it('should show validation error for short password when setting', async () => {
    render(<ProfilePage />);
    await navigateToSecurityTab();

    fireEvent.change(screen.getByPlaceholderText('Min 8 chars, upper + lower + number'), { target: { value: 'short' } });
    fireEvent.change(screen.getByPlaceholderText('Re-enter new password'), { target: { value: 'short' } });

    const setButtons = screen.getAllByText('Set Password');
    fireEvent.click(setButtons[setButtons.length - 1]);

    expect(await screen.findByText('Password must be at least 8 characters')).toBeDefined();
    expect(mockApiPost).not.toHaveBeenCalled();
  });

  it('should show error when passwords do not match when setting', async () => {
    render(<ProfilePage />);
    await navigateToSecurityTab();

    fireEvent.change(screen.getByPlaceholderText('Min 8 chars, upper + lower + number'), { target: { value: 'MyNewPass1!' } });
    fireEvent.change(screen.getByPlaceholderText('Re-enter new password'), { target: { value: 'DifferentPass!' } });

    const setButtons = screen.getAllByText('Set Password');
    fireEvent.click(setButtons[setButtons.length - 1]);

    await waitFor(() => {
      expect(document.body.textContent).toContain('Passwords do not match');
    });
    expect(mockApiPost).not.toHaveBeenCalled();
  });

  it('should show password status as "Not Set" in account security', async () => {
    render(<ProfilePage />);
    await navigateToSecurityTab();

    expect(await screen.findByText('Not Set')).toBeDefined();
  });
});
