/**
 * FeatureBarV2 — the selected tradition's sub-feature bar persists.
 *
 * On a tradition page the bar follows the URL. On cross-cutting pages
 * (My Day, home, …) it falls back to the user's persisted
 * `primaryTradition`, so the selected tradition and its sub-features stay
 * put until the user switches. The persisted fallback is gated on store
 * hydration to avoid an SSR/client mismatch.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import React from 'react';

const h = vi.hoisted(() => ({
  pathname: '/' as string,
  user: null as { primaryTradition?: string | null } | null,
  hydrated: true as boolean,
}));

vi.mock('next/navigation', () => ({
  usePathname: () => h.pathname,
}));

vi.mock('@/lib/store', () => ({
  useAuthStore: () => ({ user: h.user }),
  useAuthHydrated: () => h.hydrated,
}));

async function importBar() {
  const mod = await import('@/components/layout/v2/FeatureBarV2');
  return mod.default;
}

describe('FeatureBarV2 tradition persistence', () => {
  beforeEach(() => {
    h.pathname = '/';
    h.user = null;
    h.hydrated = true;
  });

  it('renders nothing on home when no tradition is selected', async () => {
    h.pathname = '/';
    const Bar = await importBar();
    const { container } = render(<Bar />);
    expect(container.firstChild).toBeNull();
  });

  it('renders the URL tradition sub-features on a tradition page', async () => {
    h.pathname = '/western/natal';
    const Bar = await importBar();
    const { container } = render(<Bar />);
    expect(container.querySelectorAll('li').length).toBeGreaterThan(0);
  });

  it('persists the selected tradition bar on My Day via primaryTradition', async () => {
    h.pathname = '/my-day';
    h.user = { primaryTradition: 'VEDIC' };
    const Bar = await importBar();
    const { container } = render(<Bar />);
    expect(container.querySelectorAll('li').length).toBeGreaterThan(0);
  });

  it('persists the selected tradition bar on the home page too', async () => {
    h.pathname = '/';
    h.user = { primaryTradition: 'VEDIC' };
    const Bar = await importBar();
    const { container } = render(<Bar />);
    expect(container.querySelectorAll('li').length).toBeGreaterThan(0);
  });

  it('does NOT apply the persisted fallback until the store has hydrated', async () => {
    h.pathname = '/my-day';
    h.user = { primaryTradition: 'VEDIC' };
    h.hydrated = false;
    const Bar = await importBar();
    const { container } = render(<Bar />);
    expect(container.firstChild).toBeNull();
  });
});
