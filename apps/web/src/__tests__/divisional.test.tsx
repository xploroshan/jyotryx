/**
 * Divisional Charts Page Rendering Tests
 *
 * Validates that the Divisional page renders correctly with chart type selection,
 * birth detail form fields, generate button, and error on empty submission.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';

// ─── Mock store ──────────────────────────────────────────────────────────────
vi.mock('@/lib/store', () => ({
  useAuthStore: Object.assign(vi.fn(() => ({
    isAuthenticated: true,
    user: { name: 'Test' },
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
import DivisionalPage from '@/app/divisional/page';

describe('Divisional Charts Page', () => {
  beforeEach(() => {
    mockPost.mockReset();
  });

  it('should render chart type selection (D9 Navamsa, D10 Dashamsha)', () => {
    render(<DivisionalPage />);
    expect(screen.getByText('D9 — Navamsa')).toBeDefined();
    expect(screen.getByText('D10 — Dashamsha')).toBeDefined();
  });

  it('should render birth detail form fields (date, time, place)', () => {
    render(<DivisionalPage />);
    expect(screen.getByText('Date of Birth')).toBeDefined();
    expect(screen.getByText('Time of Birth')).toBeDefined();
    expect(screen.getByText('Place of Birth')).toBeDefined();
    expect(screen.getByPlaceholderText('City, Country')).toBeDefined();
  });

  it('should render generate button', () => {
    render(<DivisionalPage />);
    expect(screen.getByText('Generate Chart')).toBeDefined();
  });

  it('should show error on empty form submission', async () => {
    render(<DivisionalPage />);

    fireEvent.click(screen.getByText('Generate Chart'));

    await waitFor(() => {
      expect(screen.getByText('Please fill all fields')).toBeDefined();
    });
  });
});
