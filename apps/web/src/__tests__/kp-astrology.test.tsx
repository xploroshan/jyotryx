/**
 * KP Astrology Page Rendering Tests
 *
 * Validates that the KP Astrology page renders correctly with page title,
 * birth detail form inputs, generate button, and error on empty submission.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';

// ─── Mock store ──────────────────────────────────────────────────────────────
const mockStoreState = {
  isAuthenticated: true,
  user: { name: 'Test' },
};
vi.mock('@/lib/store', () => ({
  useAuthStore: Object.assign(
    vi.fn((selector?: any) => (selector ? selector(mockStoreState) : mockStoreState)),
    { getState: () => mockStoreState },
  ),
  useAuthHydrated: () => true,
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
import KPAstrologyPage from '@/app/kp-astrology/page';

describe('KP Astrology Page', () => {
  beforeEach(() => {
    mockPost.mockReset();
  });

  it('should render page title "KP Astrology"', () => {
    render(<KPAstrologyPage />);
    expect(screen.getByText('KP Astrology')).toBeDefined();
  });

  it('should render birth detail form inputs', () => {
    render(<KPAstrologyPage />);
    expect(screen.getByText('Date of Birth')).toBeDefined();
    expect(screen.getByText('Time of Birth')).toBeDefined();
    expect(screen.getByText('Place of Birth')).toBeDefined();
    expect(screen.getByPlaceholderText('City, Country')).toBeDefined();
  });

  it('should render generate button', () => {
    render(<KPAstrologyPage />);
    expect(screen.getByText('Generate KP Chart')).toBeDefined();
  });

  it('should show error message when fields are empty and button is clicked', async () => {
    render(<KPAstrologyPage />);

    fireEvent.click(screen.getByText('Generate KP Chart'));

    await waitFor(() => {
      expect(screen.getByText('Please fill all fields')).toBeDefined();
    });
  });
});
