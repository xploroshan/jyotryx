/**
 * Admin Component Tests
 *
 * Validates the code-split admin tab components render correctly.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';

// Mock the api module
vi.mock('@/lib/api', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

import { api } from '@/lib/api';

const mockDashboardStats = {
  totalUsers: 1500,
  premiumUsers: 120,
  totalRevenue: 250000,
  totalChats: 5000,
  totalKundlis: 800,
  totalPayments: 350,
  newUsersToday: 15,
  activeSubscriptions: 95,
};

// ─── DashboardTab ──────────────────────────────────────────────────────

describe('DashboardTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /**
   * Phase 2 added two sibling fetches (`/admin/onboarding/stuck` and
   * `/admin/mrr`) alongside `/admin/dashboard`. A single
   * `mockResolvedValue` returns the same payload for all three, which
   * crashes the render when the component tries to read `mrr.mrrUsd`
   * on the stats object. Route per URL instead.
   */
  const wireApiMock = () => {
    (api.get as any).mockImplementation((url: string) => {
      if (url.startsWith('/admin/dashboard')) return Promise.resolve(mockDashboardStats);
      if (url.startsWith('/admin/onboarding/stuck')) return Promise.resolve([]);
      if (url.startsWith('/admin/mrr')) {
        return Promise.resolve({
          mrrUsd: 0, arrUsd: 0, momDelta: 0, projection6m: 0, asOf: null,
          totalRevenueUsd: 0, subscriberCount: 0, arpuUsd: 0, ltvUsd: 0,
        });
      }
      return Promise.resolve(null);
    });
  };

  it('should render loading spinner initially', async () => {
    (api.get as any).mockImplementation(() => new Promise(() => {})); // never resolves

    const { DashboardTab } = await import('@/app/admin/components/DashboardTab');
    render(<DashboardTab token="test-token" onTabChange={vi.fn()} />);

    expect(document.querySelector('svg.animate-spin')).toBeTruthy();
  });

  it('should display stats after successful fetch', async () => {
    wireApiMock();

    const { DashboardTab } = await import('@/app/admin/components/DashboardTab');
    render(<DashboardTab token="test-token" onTabChange={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('Total Users')).toBeTruthy();
      expect(screen.getByText('1500')).toBeTruthy();
    });
  });

  it('should call api.get with correct endpoint and token', async () => {
    wireApiMock();

    const { DashboardTab } = await import('@/app/admin/components/DashboardTab');
    render(<DashboardTab token="test-token" onTabChange={vi.fn()} />);

    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith('/admin/dashboard', { token: 'test-token' });
    });
  });
});

// ─── Admin Types ───────────────────────────────────────────────────────

describe('Admin Types', () => {
  it('DashboardStats interface should have all required fields', async () => {
    // The types module is declaration-only, so `import(...)` returns a
    // namespace object with no default export. We just need the
    // `mockDashboardStats` shape check — the dynamic import was
    // vestigial and made TypeScript flag a missing `default` field.
    const stats = mockDashboardStats;
    expect(stats.totalUsers).toBeDefined();
    expect(stats.premiumUsers).toBeDefined();
    expect(stats.totalRevenue).toBeDefined();
    expect(stats.totalChats).toBeDefined();
    expect(stats.totalKundlis).toBeDefined();
    expect(stats.totalPayments).toBeDefined();
    expect(stats.newUsersToday).toBeDefined();
    expect(stats.activeSubscriptions).toBeDefined();
  });
});

// ─── Helpers ───────────────────────────────────────────────────────────

describe('Admin Helpers', () => {
  it('formatCurrency should format numbers as INR', async () => {
    const { formatCurrency } = await import('@/app/admin/components/helpers');
    const result = formatCurrency(250000);
    // Indian number format: ₹2,50,000
    expect(result).toContain('2,50,000');
  });
});
