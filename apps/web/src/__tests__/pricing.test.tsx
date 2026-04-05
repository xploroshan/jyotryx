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
    mockApiGet.mockResolvedValueOnce({ 'pricing.monthly.price': '499', 'pricing.annual.price': '4999' });
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
});
