/**
 * TraditionRail + FeatureChips — layout-component unit tests.
 *
 * These are the two global layout bars that ship on every route. Both
 * previously highlighted a pill based on the user's saved "primary
 * tradition" whenever the URL didn't contain a tradition slug — so the
 * homepage, /profile, /pricing, /kundli, /chat and other shared pages
 * kept painting e.g. "Western" as active. These tests pin down the
 * correct invariant: selection follows the URL, not saved state.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import React from 'react';

// jsdom doesn't implement scrollIntoView; the rail calls it on the
// active pill after mount to keep it centered on mobile.
if (typeof (Element.prototype as any).scrollIntoView !== 'function') {
  (Element.prototype as any).scrollIntoView = function () {};
}

const mockPathname = vi.fn(() => '/');
const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  usePathname: () => mockPathname(),
  useRouter: () => ({ push: mockPush }),
}));

vi.mock('@/lib/api', () => ({
  api: { put: vi.fn().mockResolvedValue({}) },
}));

const mockAuthState = {
  user: {
    id: 'u1',
    name: 'Test',
    email: 't@t.com',
    credits: 0,
    role: 'USER',
    astrologyTraditions: ['VEDIC', 'WESTERN'],
    // Deliberately set primary to Western so the old buggy behaviour
    // (highlight primary when URL doesn't match) would fail this test.
    primaryTradition: 'WESTERN',
    profileComplete: true,
  },
  isAuthenticated: true,
  updatePrimaryTradition: vi.fn(),
};
vi.mock('@/lib/store', () => ({
  useAuthStore: Object.assign(
    vi.fn((selector?: any) =>
      typeof selector === 'function' ? selector(mockAuthState) : mockAuthState,
    ),
    { getState: () => mockAuthState },
  ),
}));

async function importRail() {
  const mod = await import('@/components/layout/TraditionRail');
  return mod.default;
}
async function importChips() {
  const mod = await import('@/components/layout/FeatureChips');
  return mod.default;
}

/** Count how many tabs in the rail are aria-selected. */
function countSelectedTabs(container: HTMLElement): number {
  return container.querySelectorAll('[role="tab"][aria-selected="true"]').length;
}

describe('TraditionRail active-state (URL-driven)', () => {
  beforeEach(() => {
    mockPush.mockReset();
    mockPathname.mockReset();
  });

  it('selects no pill on the homepage (even if primary is Western)', async () => {
    mockPathname.mockReturnValue('/');
    const Rail = await importRail();
    const { container } = render(<Rail />);
    expect(countSelectedTabs(container)).toBe(0);
  });

  it('selects no pill on /profile', async () => {
    mockPathname.mockReturnValue('/profile');
    const Rail = await importRail();
    const { container } = render(<Rail />);
    expect(countSelectedTabs(container)).toBe(0);
  });

  it('selects no pill on tradition-agnostic feature pages (/kundli, /chat, /palmistry)', async () => {
    for (const path of ['/kundli', '/chat', '/palmistry', '/pricing', '/reports']) {
      mockPathname.mockReturnValue(path);
      const Rail = await importRail();
      const { container, unmount } = render(<Rail />);
      expect(countSelectedTabs(container)).toBe(0);
      unmount();
    }
  });

  it('selects exactly the Western pill on /western/natal', async () => {
    mockPathname.mockReturnValue('/western/natal');
    const Rail = await importRail();
    const { container } = render(<Rail />);
    const selected = container.querySelectorAll('[role="tab"][aria-selected="true"]');
    expect(selected).toHaveLength(1);
    expect(selected[0].getAttribute('aria-label')).toMatch(/western/i);
  });

  it('selects only My Day on /my-day', async () => {
    mockPathname.mockReturnValue('/my-day');
    const Rail = await importRail();
    const { container } = render(<Rail />);
    const selected = container.querySelectorAll('[role="tab"][aria-selected="true"]');
    expect(selected).toHaveLength(1);
    expect(selected[0].getAttribute('aria-label')).toMatch(/my day/i);
  });
});

describe('FeatureChips rendering (URL-driven)', () => {
  beforeEach(() => {
    mockPathname.mockReset();
  });

  it('renders nothing on the homepage', async () => {
    mockPathname.mockReturnValue('/');
    const Chips = await importChips();
    const { container } = render(<Chips />);
    // Component returns null ⇒ no rendered content.
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing on /profile, /pricing, /reports, /kundli, /chat', async () => {
    for (const path of ['/profile', '/pricing', '/reports', '/kundli', '/chat']) {
      mockPathname.mockReturnValue(path);
      const Chips = await importChips();
      const { container, unmount } = render(<Chips />);
      expect(container.firstChild).toBeNull();
      unmount();
    }
  });

  it('renders chips when inside a tradition section', async () => {
    mockPathname.mockReturnValue('/western/natal');
    const Chips = await importChips();
    const { container } = render(<Chips />);
    // Something rendered → at least one list item.
    expect(container.querySelectorAll('li').length).toBeGreaterThan(0);
  });
});
