/**
 * Tarot Page Rendering Tests
 *
 * Validates that the Tarot page renders correctly with spread selection,
 * question input, draw button, loading state, and error handling.
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
import TarotPage from '@/app/tarot/page';

describe('Tarot Page', () => {
  beforeEach(() => {
    mockPost.mockReset();
  });

  it('should render spread selection buttons (Single Card, Three Card, Celtic Cross)', () => {
    render(<TarotPage />);
    expect(screen.getByText('Single Card')).toBeDefined();
    expect(screen.getByText('Three Card')).toBeDefined();
    expect(screen.getByText('Celtic Cross')).toBeDefined();
  });

  it('should render question input field', () => {
    render(<TarotPage />);
    expect(screen.getByPlaceholderText('What guidance do you seek?')).toBeDefined();
  });

  it('should render draw button', () => {
    render(<TarotPage />);
    expect(screen.getByText('Draw Cards')).toBeDefined();
  });

  it('should show loading state when drawing', async () => {
    mockPost.mockImplementation(() => new Promise(() => {})); // never resolves
    render(<TarotPage />);

    fireEvent.click(screen.getByText('Draw Cards'));

    await waitFor(() => {
      expect(screen.getByText('Drawing cards...')).toBeDefined();
    });
  });

  it('should display error message on failure', async () => {
    mockPost.mockRejectedValueOnce(new Error('Network error'));
    render(<TarotPage />);

    fireEvent.click(screen.getByText('Draw Cards'));

    await waitFor(() => {
      expect(screen.getByText('Network error')).toBeDefined();
    });
  });
});
