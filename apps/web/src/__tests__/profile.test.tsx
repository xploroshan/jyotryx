/**
 * Profile Page Tests
 *
 * Validates auth guard redirect, profile header rendering, birth details form,
 * security tab, account security info, and logout behaviour.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';

// ─── Mock next/navigation ───────────────────────────────────────────────────
const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

// ─── Mock store state ───────────────────────────────────────────────────────
const mockStoreState = {
  user: { id: '1', name: 'Test User', email: 'test@test.com', credits: 10, role: 'user' },
  accessToken: 'valid-token',
  refreshToken: 'valid-refresh',
  isAuthenticated: true,
  setAuth: vi.fn(),
  updateCredits: vi.fn(),
  logout: vi.fn(),
};

vi.mock('@/lib/store', () => ({
  useAuthStore: Object.assign(
    vi.fn((selector?: any) => selector ? selector(mockStoreState) : mockStoreState),
    { getState: () => mockStoreState },
  ),
}));

// ─── Mock API ───────────────────────────────────────────────────────────────
const mockApiPost = vi.fn();
const mockApiGet = vi.fn();
const mockApiPut = vi.fn();
vi.mock('@/lib/api', () => ({
  api: {
    get: (...args: any[]) => mockApiGet(...args),
    post: (...args: any[]) => mockApiPost(...args),
    put: (...args: any[]) => mockApiPut(...args),
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
};
const mockCredits = { available: 10, used: 5, total: 15, role: 'user', resetsAt: '2026-05-01' };
const mockAuthStatus = { hasPassword: true };

// ─── Import component AFTER mocks ──────────────────────────────────────────
import ProfilePage from '@/app/profile/page';

// ─── Helper: set up API mock to resolve profile data ────────────────────────
function setupApiMocks() {
  mockApiGet.mockImplementation((url: string) => {
    if (url === '/users/me') return Promise.resolve(mockProfile);
    if (url === '/users/me/credits') return Promise.resolve(mockCredits);
    if (url === '/auth/status') return Promise.resolve(mockAuthStatus);
    return Promise.resolve({});
  });
}

describe('Profile Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStoreState.isAuthenticated = true;
    mockStoreState.accessToken = 'valid-token';
    setupApiMocks();
  });

  it('redirects to /auth when not authenticated', () => {
    mockStoreState.isAuthenticated = false;
    render(<ProfilePage />);
    expect(mockPush).toHaveBeenCalledWith('/auth');
  });

  it('renders profile header with name and email', async () => {
    render(<ProfilePage />);
    expect(await screen.findByText('Test User')).toBeDefined();
    expect(await screen.findByText('test@test.com')).toBeDefined();
  });

  it('renders Birth Details tab with form fields', async () => {
    render(<ProfilePage />);
    const bdEls = await screen.findAllByText('Birth Details');
    expect(bdEls.length).toBeGreaterThanOrEqual(1);
    // Wait for profile to fully load
    await screen.findByText('Test User');
    const body = document.body.textContent || '';
    expect(body).toContain('Full Name');
    expect(body).toContain('Phone Number');
    expect(body).toContain('Date of Birth');
    expect(body).toContain('Time of Birth');
    expect(body).toContain('Place of Birth');
    expect(body).toContain('Gender');
    expect(body).toContain('Profession');
    expect(body).toContain('Save Changes');
  });

  it('renders Security tab when clicked', async () => {
    render(<ProfilePage />);
    // Wait for profile to load first
    await screen.findByText('Test User');
    const securityBtn = screen.getAllByText('Security')[0];
    fireEvent.click(securityBtn);
    // Check for security tab content in DOM text
    const body = document.body.textContent || '';
    expect(body).toContain('Change Password');
    expect(body).toContain('New Password');
    expect(body).toContain('Confirm New Password');
  });

  it('renders account security info in Security tab', async () => {
    render(<ProfilePage />);
    await screen.findByText('Test User');
    const securityBtn = screen.getAllByText('Security')[0];
    fireEvent.click(securityBtn);
    const body = document.body.textContent || '';
    expect(body).toContain('Account Security');
    expect(body).toContain('Two-Factor Auth');
  });

  it('logout button calls logout and redirects to /', async () => {
    render(<ProfilePage />);
    const logoutBtn = await screen.findByText('Logout');
    fireEvent.click(logoutBtn);
    expect(mockStoreState.logout).toHaveBeenCalled();
    expect(mockPush).toHaveBeenCalledWith('/');
  });
});
