/**
 * Pricing Page Tests
 *
 * Validates plan rendering, feature lists, popular badge,
 * auth guard on subscribe, and free plan redirect.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';

// ─── Mock next/navigation ───────────────────────────────────────────────────
const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  usePathname: () => '/',
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
  useAuthHydrated: () => true,
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

// ─── Import component AFTER mocks ──────────────────────────────────────────
import PricingPage from '@/app/pricing/PricingClient';

describe('Pricing Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStoreState.isAuthenticated = true;
    mockStoreState.accessToken = 'valid-token';
    // Subscriptions must be ON for the paid plan cards to render at all —
    // the page now refuses to advertise a Subscribe CTA the backend would
    // 400 ("Subscriptions are not currently available.").
    mockApiGet.mockResolvedValueOnce({
      'feature.pricing_page_enabled': 'true',
      'feature.subscriptions_enabled': 'true',
      'pricing.monthly.price': '499',
      'pricing.annual.price': '4999',
    });
  });

  it('renders header with pricing text', async () => {
    render(<PricingPage />);
    expect(await screen.findByText('pricing')).toBeDefined();
  });

  it('renders all 3 plan names', async () => {
    render(<PricingPage />);
    // "Free" appears as both plan name and price text, so use getAllByText
    const freeElements = await screen.findAllByText('Free');
    expect(freeElements.length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Premium')).toBeDefined();
    expect(screen.getByText('Annual')).toBeDefined();
  });

  it('renders Most Popular badge on Premium plan', async () => {
    render(<PricingPage />);
    expect(await screen.findByText('Most Popular')).toBeDefined();
  });

  it('renders Free plan features', async () => {
    render(<PricingPage />);
    expect(await screen.findByText('Kundli, matching & panchang — free')).toBeDefined();
    expect(await screen.findByText('50 chat messages')).toBeDefined();
    expect(await screen.findByText('1 detailed report + 2 palm readings')).toBeDefined();
    expect(await screen.findByText('Daily almanac email')).toBeDefined();
  });

  it('renders Premium plan features (shown on both paid cards)', async () => {
    render(<PricingPage />);
    // The monthly and annual cards share one Premium feature list, so each
    // benefit appears twice. Assert presence via getAllByText (>= 1).
    expect((await screen.findAllByText('Unlimited deep-dive interpretations')).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('1,000 chat messages / month').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('4 palmistry readings / month').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Monthly personalised report').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Priority support').length).toBeGreaterThanOrEqual(1);
  });

  it('redirects to /auth when unauthenticated user clicks subscribe', async () => {
    mockStoreState.isAuthenticated = false;
    render(<PricingPage />);
    // Both paid plans now use the "Subscribe" CTA; click the first.
    const subscribeBtns = await screen.findAllByText('Subscribe');
    fireEvent.click(subscribeBtns[0]);
    expect(mockPush).toHaveBeenCalledWith('/auth?mode=signup');
  });

  it('redirects to /chat when clicking Free plan Get Started', async () => {
    render(<PricingPage />);
    const getStartedBtn = await screen.findByText('Get Started');
    fireEvent.click(getStartedBtn);
    expect(mockPush).toHaveBeenCalledWith('/chat');
  });

  it('renders skeletons on first paint (no hardcoded price flash)', () => {
    // This test deliberately does NOT await findBy — it asserts the
    // synchronous initial render. Before the fix, the page rendered
    // `₹499` synchronously from the hardcoded `defaultPlans`. After the
    // fix, the initial render shows skeleton placeholders until the
    // GET /payments/pricing fetch resolves.
    mockApiGet.mockReset();
    mockApiGet.mockImplementation(() => new Promise(() => {})); // never resolves
    render(<PricingPage />);
    // Skeleton placeholders are rendered instead of price text.
    expect(screen.getAllByTestId('plan-skeleton').length).toBe(3);
    expect(screen.getAllByTestId('credit-skeleton').length).toBe(3);
    // No plan prices are rendered yet.
    expect(screen.queryByText(/₹499/)).toBeNull();
    expect(screen.queryByText(/₹100/)).toBeNull();
  });

  it('displays admin-updated monthly price after fetch', async () => {
    // Simulate admin saving pricing.monthly.price = 100.
    mockApiGet.mockReset();
    mockApiGet.mockResolvedValueOnce({
      'feature.pricing_page_enabled': 'true', 'feature.subscriptions_enabled': 'true',
      'pricing.monthly.price': '100', 'pricing.annual.price': '999',
    });
    render(<PricingPage />);
    // Use findByText to wait for the post-fetch render.
    expect(await screen.findByText(/₹100/)).toBeDefined();
    // The hardcoded ₹499 default should NEVER appear.
    expect(screen.queryByText(/₹499/)).toBeNull();
  });

  it('renders credit packs from settings', async () => {
    mockApiGet.mockReset();
    mockApiGet.mockResolvedValueOnce({
      'feature.pricing_page_enabled': 'true', 'feature.subscriptions_enabled': 'true',
      'pricing.monthly.price': '499', 'pricing.annual.price': '4999',
      'pricing.credits.starter.credits': '50',
      'pricing.credits.starter.price': '99',
      'pricing.credits.popular.credits': '150',
      'pricing.credits.popular.price': '249',
      'pricing.credits.pro.credits': '500',
      'pricing.credits.pro.price': '699',
    });
    render(<PricingPage />);
    expect(await screen.findByText(/Credit Packs/)).toBeDefined();
    expect(await screen.findByText(/₹99/)).toBeDefined();
    expect(await screen.findByText(/₹249/)).toBeDefined();
    expect(await screen.findByText(/₹699/)).toBeDefined();
  });

  it('hides Subscribe plans when subscriptions are disabled (dead-end CTA guard)', async () => {
    // POST /payments/subscribe 400s while feature.subscriptions_enabled is
    // off — advertising a Subscribe button then is a guaranteed dead end.
    mockApiGet.mockReset();
    mockApiGet.mockResolvedValueOnce({
      'feature.pricing_page_enabled': 'true',
      'feature.subscriptions_enabled': 'false',
      'pricing.monthly.price': '499', 'pricing.annual.price': '4999',
    });
    render(<PricingPage />);
    // The free tier still renders…
    expect(await screen.findByText('Get Started')).toBeDefined();
    // …but no Subscribe CTA and no paid plan prices.
    expect(screen.queryByText('Subscribe')).toBeNull();
    expect(screen.queryByText(/₹499/)).toBeNull();
  });

  it('hides credit packs that have no saved settings (checkout would reject them)', async () => {
    // resolveCreditPack (server) returns null for unconfigured packs, so
    // rendering hardcoded fallbacks sold packs checkout rejects as invalid.
    mockApiGet.mockReset();
    mockApiGet.mockResolvedValueOnce({
      'feature.pricing_page_enabled': 'true',
      'feature.subscriptions_enabled': 'true',
      'pricing.monthly.price': '499', 'pricing.annual.price': '4999',
      // Only the starter pack is configured.
      'pricing.credits.starter.credits': '50',
      'pricing.credits.starter.price': '99',
    });
    render(<PricingPage />);
    expect(await screen.findByText(/Credit Packs/)).toBeDefined();
    expect(await screen.findByText(/₹99/)).toBeDefined();
    // The old hardcoded popular/pro fallbacks must not render.
    expect(screen.queryByText(/₹249/)).toBeNull();
    expect(screen.queryByText(/₹699/)).toBeNull();
  });

  it('keeps configured credit packs purchasable on the "everything free" hero (chat funnel)', async () => {
    // pricing page OFF + credits ON: chat still charges credits and its
    // out-of-credits modal routes here — the packs must stay buyable.
    mockApiGet.mockReset();
    mockApiGet.mockResolvedValueOnce({
      'feature.pricing_page_enabled': 'false',
      'feature.credits_enabled': 'true',
      'pricing.credits.starter.credits': '50',
      'pricing.credits.starter.price': '99',
    });
    render(<PricingPage />);
    expect(await screen.findByText(/Everything is/)).toBeDefined();
    expect(await screen.findByText(/₹99/)).toBeDefined();
    // No subscription plans on the free hero.
    expect(screen.queryByText('Subscribe')).toBeNull();
  });
});
