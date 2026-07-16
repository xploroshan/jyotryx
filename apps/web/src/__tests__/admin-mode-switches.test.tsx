/**
 * Admin monetization mode switches — INSTANT SAVE regression tests.
 *
 * The palmistry-paywall incident: "Make app completely free" rendered as a
 * switch that turned green immediately but only staged local state — the
 * real write was the "Save Pricing" button several screens below. The admin
 * flipped it, left the page, and the app kept charging. These tests pin the
 * fix: flipping a mode switch PUTs that flag immediately, and a failed PUT
 * reverts the switch so it never shows a state that didn't save.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';

const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  usePathname: () => '/admin',
}));

const mockStoreState = {
  user: { id: 'admin-1', name: 'Admin', email: 'admin@test.com', role: 'ADMIN' },
  accessToken: 'admin-token',
  isAuthenticated: true,
};
vi.mock('@/lib/store', () => ({
  useAuthStore: Object.assign(
    vi.fn((selector?: any) => (selector ? selector(mockStoreState) : mockStoreState)),
    { getState: () => mockStoreState },
  ),
  useAuthHydrated: () => true,
}));

const mockApiGet = vi.fn();
const mockApiPut = vi.fn();
vi.mock('@/lib/api', () => ({
  api: {
    get: (...args: any[]) => mockApiGet(...args),
    put: (...args: any[]) => mockApiPut(...args),
    post: vi.fn(),
    delete: vi.fn(),
    upload: vi.fn(),
  },
}));

import AdminPage from '@/app/admin/page';

function wireApiGet(flags: Record<string, string> = {}) {
  mockApiGet.mockImplementation((url: string) => {
    if (url.startsWith('/admin/settings?prefix=feature.')) return Promise.resolve(flags);
    if (url.startsWith('/admin/settings')) return Promise.resolve({});
    if (url.startsWith('/admin/access-matrix')) {
      return Promise.resolve({
        flags: { freeMode: false, creditsEnabled: true, subscriptionsEnabled: false },
        features: [],
      });
    }
    // Dashboard-tab fetches (initial tab) — keep them pending forever so
    // that tab stays in its loading state while we work in Pricing.
    return new Promise(() => {});
  });
}

async function openPricingTab() {
  render(<AdminPage />);
  fireEvent.click(screen.getByRole('button', { name: /Pricing/ }));
  await waitFor(() => {
    expect(screen.getByText('Make app completely free')).toBeTruthy();
  });
}

/** The free-mode switch is the first card's switch in the Pricing tab. */
function freeModeSwitch(): HTMLElement {
  return screen.getAllByRole('switch')[0];
}

describe('Admin monetization mode switches (instant save)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('flipping "Make app completely free" saves the flag IMMEDIATELY (no Save button)', async () => {
    wireApiGet({ 'feature.free_mode': 'false' });
    mockApiPut.mockResolvedValue({});
    await openPricingTab();

    expect(freeModeSwitch().getAttribute('aria-checked')).toBe('false');
    fireEvent.click(freeModeSwitch());

    await waitFor(() => {
      expect(mockApiPut).toHaveBeenCalledWith(
        '/admin/settings',
        { 'feature.free_mode': 'true' },
        { token: 'admin-token' },
      );
    });
    expect(freeModeSwitch().getAttribute('aria-checked')).toBe('true');
  });

  it('the effective-access readout refetches after a switch is flipped', async () => {
    wireApiGet({ 'feature.free_mode': 'false' });
    mockApiPut.mockResolvedValue({});
    await openPricingTab();
    // Wait for the (lazy-loaded) readout card to mount and do its first fetch.
    await waitFor(
      () => {
        expect(
          mockApiGet.mock.calls.filter(([u]) => String(u).startsWith('/admin/access-matrix')).length,
        ).toBeGreaterThanOrEqual(1);
      },
      { timeout: 5000 },
    );
    const before = mockApiGet.mock.calls.filter(([u]) =>
      String(u).startsWith('/admin/access-matrix'),
    ).length;

    fireEvent.click(freeModeSwitch());

    await waitFor(
      () => {
        expect(
          mockApiGet.mock.calls.filter(([u]) => String(u).startsWith('/admin/access-matrix')).length,
        ).toBeGreaterThan(before);
      },
      { timeout: 5000 },
    );
  });

  it('a failed save REVERTS the switch — it never shows a state that did not save', async () => {
    wireApiGet({ 'feature.free_mode': 'false' });
    mockApiPut.mockRejectedValue(new Error('network down'));
    await openPricingTab();

    fireEvent.click(freeModeSwitch());

    await waitFor(() => {
      expect(mockApiPut).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(freeModeSwitch().getAttribute('aria-checked')).toBe('false');
    });
    expect(screen.getByText(/network down/)).toBeTruthy();
  });

  it('"Save Pricing" no longer writes the mode flags (stale-tab clobber guard)', async () => {
    wireApiGet({ 'feature.free_mode': 'true' });
    mockApiPut.mockResolvedValue({});
    await openPricingTab();

    fireEvent.click(screen.getByRole('button', { name: /Save Pricing/ }));

    await waitFor(() => {
      expect(mockApiPut).toHaveBeenCalled();
    });
    const payload = mockApiPut.mock.calls[0][1];
    expect(payload['feature.free_mode']).toBeUndefined();
    expect(payload['feature.subscriptions_enabled']).toBeUndefined();
    expect(payload['feature.pricing_page_enabled']).toBeUndefined();
    // The prices themselves still save.
    expect(payload['pricing.palmistry.price']).toBeDefined();
  });
});
