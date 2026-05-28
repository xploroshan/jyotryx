/**
 * FeatureBarV2 — the selected tradition's sub-feature bar persists.
 *
 * - On a tradition page (/vedic) it follows the URL.
 * - On a FEATURE page (/horoscope, /kundli) it resolves the owning
 *   tradition from the path, so opening a sub-feature never drops the bar.
 * - On tradition-agnostic pages (My Day, home) it falls back to the last
 *   tradition browsed (`activeTradition`), then the saved `primaryTradition`,
 *   so the bar stays until the user switches.
 * - The fallback is gated on store hydration to avoid an SSR/client mismatch.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import React from 'react';
import { vi } from 'vitest';

const h = vi.hoisted(() => ({
  pathname: '/' as string,
  user: null as { primaryTradition?: string | null } | null,
  activeTradition: null as string | null,
  hydrated: true as boolean,
}));

vi.mock('next/navigation', () => ({
  usePathname: () => h.pathname,
}));

vi.mock('@/lib/store', () => ({
  useAuthStore: () => ({ user: h.user, activeTradition: h.activeTradition }),
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
    h.activeTradition = null;
    h.hydrated = true;
  });

  it('renders nothing on home when no tradition is selected/remembered', async () => {
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

  it('keeps the tradition bar on a FEATURE page (e.g. /horoscope) with nothing remembered', async () => {
    // The crux: clicking a sub-feature must NOT drop the bar, even if the
    // user never explicitly picked the tradition from the dropdown.
    h.pathname = '/horoscope';
    const Bar = await importBar();
    const { container } = render(<Bar />);
    expect(container.querySelectorAll('li').length).toBeGreaterThan(0);
  });

  it('persists the bar on My Day via the remembered activeTradition', async () => {
    h.pathname = '/my-day';
    h.activeTradition = 'VEDIC';
    const Bar = await importBar();
    const { container } = render(<Bar />);
    expect(container.querySelectorAll('li').length).toBeGreaterThan(0);
  });

  it('falls back to the saved primaryTradition when nothing was browsed yet', async () => {
    h.pathname = '/';
    h.user = { primaryTradition: 'VEDIC' };
    const Bar = await importBar();
    const { container } = render(<Bar />);
    expect(container.querySelectorAll('li').length).toBeGreaterThan(0);
  });

  it('does NOT apply the remembered fallback until the store has hydrated', async () => {
    h.pathname = '/my-day';
    h.activeTradition = 'VEDIC';
    h.hydrated = false;
    const Bar = await importBar();
    const { container } = render(<Bar />);
    expect(container.firstChild).toBeNull();
  });
});
