/**
 * Checkout Page Tests
 *
 * Validates the one-time credit-pack checkout: order-summary rendering
 * from the pricing config, the auth guard (redirect to sign-up), and the
 * invalid-pack fallback. The Razorpay Checkout modal itself is not opened
 * here — that requires the external checkout.js script.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';

// ─── Mock next/navigation ───────────────────────────────────────────────────
const mockPush = vi.fn();
const mockReplace = vi.fn();
let searchParams: Record<string, string> = { type: 'credits', pack: 'starter' };
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace }),
  useSearchParams: () => ({ get: (k: string) => searchParams[k] ?? null }),
}));

// ─── Mock store state ───────────────────────────────────────────────────────
const mockStoreState = {
  user: { id: '1', name: 'Test User', email: 'test@test.com', phone: null, credits: 10, role: 'user' },
  accessToken: 'valid-token',
  refreshToken: 'valid-refresh',
  isAuthenticated: true,
  updateCredits: vi.fn(),
};
let hydrated = true;
vi.mock('@/lib/store', () => ({
  useAuthStore: Object.assign(
    vi.fn((selector?: any) => (selector ? selector(mockStoreState) : mockStoreState)),
    { getState: () => mockStoreState },
  ),
  useAuthHydrated: () => hydrated,
}));

// ─── Mock API ───────────────────────────────────────────────────────────────
const mockApiGet = vi.fn();
const mockApiPost = vi.fn();
vi.mock('@/lib/api', () => ({
  api: {
    get: (...args: any[]) => mockApiGet(...args),
    post: (...args: any[]) => mockApiPost(...args),
    put: vi.fn(),
    delete: vi.fn(),
    upload: vi.fn(),
  },
}));

import CheckoutPage from '@/app/checkout/page';

const PRICING = {
  'pricing.credits.starter.price': '99',
  'pricing.credits.starter.credits': '25',
};

describe('Checkout Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hydrated = true;
    searchParams = { type: 'credits', pack: 'starter' };
    mockStoreState.isAuthenticated = true;
    mockApiGet.mockResolvedValue(PRICING);
  });

  it('renders the order summary (credits + price) for the selected pack', async () => {
    render(<CheckoutPage />);
    expect(await screen.findByText(/25/)).toBeDefined();
    // INR formatting renders the price somewhere in the summary.
    await waitFor(() => expect(screen.getAllByText(/₹\s?99|99/).length).toBeGreaterThan(0));
  });

  it('redirects unauthenticated users to sign-up, preserving the return path', async () => {
    mockStoreState.isAuthenticated = false;
    render(<CheckoutPage />);
    await waitFor(() => expect(mockReplace).toHaveBeenCalled());
    expect(mockReplace.mock.calls[0][0]).toContain('/auth?mode=signup');
    expect(mockReplace.mock.calls[0][0]).toContain('checkout');
  });

  it('shows a fallback when the pack is unknown', async () => {
    searchParams = { type: 'credits', pack: 'does-not-exist' };
    mockApiGet.mockResolvedValue({}); // no matching settings
    render(<CheckoutPage />);
    // Falls through to the invalid-pack card with a Back control.
    expect(await screen.findByText('Back')).toBeDefined();
  });
});
