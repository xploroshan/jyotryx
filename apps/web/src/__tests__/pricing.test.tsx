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
import PricingPage from '@/app/pricing/page';

describe('Pricing Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStoreState.isAuthenticated = true;
    mockStoreState.accessToken = 'valid-token';
    mockApiGet.mockResolvedValueOnce({ 'feature.pricing_page_enabled': 'true', 'pricing.monthly.price': '499', 'pricing.annual.price': '4999' });
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
    expect(await screen.findByText('Limited consultations')).toBeDefined();
    expect(await screen.findByText('Astrologer Chat')).toBeDefined();
    expect(await screen.findByText('Daily Horoscope')).toBeDefined();
    expect(await screen.findByText('Panchang Access')).toBeDefined();
  });

  it('renders Premium plan features', async () => {
    render(<PricingPage />);
    expect(await screen.findByText('Unlimited Chat')).toBeDefined();
    expect(await screen.findByText('Kundli Generation')).toBeDefined();
    expect(await screen.findByText('Kundli Matching')).toBeDefined();
    expect(await screen.findByText('Palmistry Analysis')).toBeDefined();
    expect(await screen.findByText('Priority Support')).toBeDefined();
  });

  it('redirects to /auth when unauthenticated user clicks subscribe', async () => {
    mockStoreState.isAuthenticated = false;
    render(<PricingPage />);
    const subscribeBtn = await screen.findByText('Subscribe');
    fireEvent.click(subscribeBtn);
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
      'feature.pricing_page_enabled': 'true', 'pricing.monthly.price': '100',
      'pricing.annual.price': '999',
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
      'feature.pricing_page_enabled': 'true', 'pricing.monthly.price': '499',
      'pricing.annual.price': '4999',
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
});
