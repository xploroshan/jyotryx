/**
 * RouteFocusReset tests.
 *
 * Next.js client-side routing doesn't reset focus like a full reload
 * would — whichever nav link the user clicked stays focused, which
 * leaves a ring on the pill and (worse) silences screen readers who
 * never hear the new page. RouteFocusReset fixes this by moving focus
 * to <main> on every pathname change after first render.
 *
 * These tests pin the contract so regressions are caught before they
 * ship.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import React from 'react';

const mockPathname = vi.fn(() => '/');
vi.mock('next/navigation', () => ({
  usePathname: () => mockPathname(),
}));

async function importComponent() {
  const mod = await import('@/components/layout/RouteFocusReset');
  return mod.default;
}

describe('RouteFocusReset', () => {
  beforeEach(() => {
    mockPathname.mockReset();
    mockPathname.mockReturnValue('/');
    document.body.innerHTML = '';
  });

  it('does not steal focus on first render (cold load)', async () => {
    const input = document.createElement('input');
    const main = document.createElement('main');
    main.tabIndex = -1;
    document.body.append(main, input);
    input.focus();
    expect(document.activeElement).toBe(input);

    const Comp = await importComponent();
    render(<Comp />);

    // First render must not reassign focus — a component like auth/page
    // autofocuses the OTP input and would lose it otherwise.
    expect(document.activeElement).toBe(input);
  });

  it('moves focus to <main> when the pathname changes', async () => {
    const link = document.createElement('a');
    link.href = '#';
    link.textContent = 'Home';
    const main = document.createElement('main');
    main.tabIndex = -1;
    document.body.append(main, link);
    link.focus();

    const Comp = await importComponent();
    const { rerender } = render(<Comp />);
    // First render settled — now simulate route change.
    mockPathname.mockReturnValue('/profile');
    rerender(<Comp />);

    expect(document.activeElement).toBe(main);
  });

  it('no-ops gracefully when there is no <main> element', async () => {
    // Some very early-boot surfaces render without the layout; the
    // component must not throw in that case.
    const link = document.createElement('a');
    document.body.append(link);
    link.focus();

    const Comp = await importComponent();
    const { rerender } = render(<Comp />);
    mockPathname.mockReturnValue('/anywhere');
    expect(() => rerender(<Comp />)).not.toThrow();
  });
});
