/**
 * Checkout Page Tests
 *
 * Validates the one-time credit-pack checkout: order-summary rendering
 * from the pricing config, the auth guard (redirect to sign-up), the
 * invalid-pack fallback, and — security-critical — that the amount is sent
 * in INR rupees (not paise) and that verification sends ONLY the orderId
 * (no client-trusted signature), so the client can't influence the grant.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import React from 'react';

// ─── Mock the Cashfree SDK loader ───────────────────────────────────────────
const mockCheckout = vi.fn(async () => ({}));
vi.mock('@/lib/cashfree', () => ({
  CASHFREE_MODE: 'sandbox',
  loadCashfree: vi.fn(async () => ({ checkout: mockCheckout })),
}));

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

  it('sends the amount in RUPEES and verifies with only the orderId', async () => {
    mockApiPost.mockImplementation((path: string) => {
      if (path === '/payments/create-order') {
        return Promise.resolve({ orderId: 'cf_o1', paymentSessionId: 'sess_1', amount: 99, currency: 'INR' });
      }
      if (path === '/payments/verify') {
        return Promise.resolve({ verified: true, creditsAdded: 25 });
      }
      return Promise.reject(new Error(`unexpected POST ${path}`));
    });

    render(<CheckoutPage />);
    // Wait for the pack price to load, then click the (single) buy button.
    await screen.findByText(/25/);
    const buyBtn = await screen.findByRole('button');
    fireEvent.click(buyBtn);

    // create-order must carry the price in rupees (99), NOT paise (9900).
    await waitFor(() =>
      expect(mockApiPost).toHaveBeenCalledWith(
        '/payments/create-order',
        expect.objectContaining({ amount: 99, productId: 'credits_starter', currency: 'INR' }),
        expect.anything(),
      ),
    );
    // The Cashfree checkout is opened with the server-issued session id.
    await waitFor(() =>
      expect(mockCheckout).toHaveBeenCalledWith(
        expect.objectContaining({ paymentSessionId: 'sess_1' }),
      ),
    );
    // verify carries ONLY the orderId — no client signature the server would trust.
    await waitFor(() =>
      expect(mockApiPost).toHaveBeenCalledWith(
        '/payments/verify',
        { orderId: 'cf_o1' },
        expect.anything(),
      ),
    );
  });
});
