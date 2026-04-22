/**
 * Vastu Page Rendering Tests
 *
 * Validates that the Vastu page renders correctly with property type selection,
 * direction buttons, analyze button, and error handling.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';

// ─── Mock store ──────────────────────────────────────────────────────────────
vi.mock('@/lib/store', () => ({
  useAuthStore: Object.assign(vi.fn(() => ({
    isAuthenticated: true,
    user: { name: 'Test' },
  useAuthHydrated: () => true,
})), {
    getState: () => ({ isAuthenticated: true, user: { name: 'Test' } }),
  }),
}));

// ─── Mock API ────────────────────────────────────────────────────────────────
const mockPost = vi.fn();

vi.mock('@/lib/api', () => ({
  api: {
    post: (...args: any[]) => mockPost(...args),
    get: vi.fn(),
  },
}));

// ─── Mock next/navigation ────────────────────────────────────────────────────
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

// ─── Import component AFTER mocks ───────────────────────────────────────────
import VastuPage from '@/app/vastu/page';

describe('Vastu Page', () => {
  beforeEach(() => {
    mockPost.mockReset();
  });

  it('should render property type buttons (House, Apartment, etc.)', () => {
    render(<VastuPage />);
    expect(screen.getByText('House')).toBeDefined();
    expect(screen.getByText('Apartment')).toBeDefined();
    expect(screen.getByText('Office')).toBeDefined();
    expect(screen.getByText('Shop')).toBeDefined();
    expect(screen.getByText('Factory')).toBeDefined();
    expect(screen.getByText('Plot')).toBeDefined();
  });

  it('should render direction buttons (North, South, East, West, etc.)', () => {
    render(<VastuPage />);
    expect(screen.getByText('North')).toBeDefined();
    expect(screen.getByText('South')).toBeDefined();
    expect(screen.getByText('East')).toBeDefined();
    expect(screen.getByText('West')).toBeDefined();
    expect(screen.getByText('North-East')).toBeDefined();
    expect(screen.getByText('South-West')).toBeDefined();
  });

  it('should render analyze button', () => {
    render(<VastuPage />);
    expect(screen.getByText('Analyze Vastu')).toBeDefined();
  });

  it('should show error message on API failure', async () => {
    mockPost.mockRejectedValueOnce(new Error('Analysis failed'));
    render(<VastuPage />);

    fireEvent.click(screen.getByText('Analyze Vastu'));

    await waitFor(() => {
      expect(screen.getByText('Analysis failed')).toBeDefined();
    });
  });
});
