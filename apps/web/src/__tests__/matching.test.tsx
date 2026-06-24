/**
 * Matching Page Tests
 *
 * Validates form rendering, auth guard on submit, and compatibility result display.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';

// ─── Mock next/navigation ───────────────────────────────────────────────────
const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

// ─── Mock store state ───────────────────────────────────────────────────────
const mockStoreState = {
  user: { id: '1', name: 'Test User', email: 'test@test.com', credits: 10, role: 'user' },
  accessToken: 'valid-token' as string | null,
  refreshToken: 'valid-refresh',
  isAuthenticated: true,
  setAuth: vi.fn(),
  updateCredits: vi.fn(),
  logout: vi.fn(),
};

vi.mock('@/lib/store', () => ({
  useAuthStore: Object.assign(
    vi.fn(() => mockStoreState),
    { getState: () => mockStoreState },
  ),
  useAuthHydrated: () => true,
}));

// ─── Mock API ───────────────────────────────────────────────────────────────
const mockApiPost = vi.fn();
const mockApiGet = vi.fn();
vi.mock('@/lib/api', () => ({
  api: {
    get: (...args: any[]) => mockApiGet(...args),
    post: (...args: any[]) => mockApiPost(...args),
    put: vi.fn(),
    delete: vi.fn(),
    upload: vi.fn(),
  },
}));

// ─── Mock matching result ───────────────────────────────────────────────────
const mockMatchingResult = {
  totalScore: 28,
  maxScore: 36,
  compatibility: 'Good Match',
  recommendation: 'This is a favorable match.',
  gunaDetails: [
    { guna: 'Varna', description: 'Spiritual compatibility', obtainedPoints: 1, maxPoints: 1 },
    { guna: 'Vashya', description: 'Mutual attraction', obtainedPoints: 2, maxPoints: 2 },
    { guna: 'Tara', description: 'Birth star compatibility', obtainedPoints: 3, maxPoints: 3 },
    { guna: 'Yoni', description: 'Physical compatibility', obtainedPoints: 3, maxPoints: 4 },
    { guna: 'Graha Maitri', description: 'Intellectual compatibility', obtainedPoints: 5, maxPoints: 5 },
    { guna: 'Gana', description: 'Temperament', obtainedPoints: 4, maxPoints: 6 },
    { guna: 'Bhakoot', description: 'Love harmony', obtainedPoints: 7, maxPoints: 7 },
    { guna: 'Nadi', description: 'Health compatibility', obtainedPoints: 3, maxPoints: 8 },
  ],
};

// ─── Import component AFTER mocks ───────────────────────────────────────────
import MatchingPage from '@/app/matching/page';

// ─── Helper: fill both person forms ─────────────────────────────────────────
// Re-query elements after each change since PersonFormComponent is re-created on every render.
function fillBothForms() {
  // Person A
  fireEvent.change(screen.getAllByPlaceholderText('Enter name')[0], { target: { value: 'Rohan Sharma' } });
  fireEvent.change(document.querySelectorAll('input[type="date"]')[0], { target: { value: '1990-05-15' } });
  fireEvent.change(document.querySelectorAll('input[type="time"]')[0], { target: { value: '10:30' } });
  fireEvent.change(screen.getAllByPlaceholderText('Search city...')[0], { target: { value: 'Delhi' } });

  // Person B
  fireEvent.change(screen.getAllByPlaceholderText('Enter name')[1], { target: { value: 'Priya Patel' } });
  fireEvent.change(document.querySelectorAll('input[type="date"]')[1], { target: { value: '1992-08-20' } });
  fireEvent.change(document.querySelectorAll('input[type="time"]')[1], { target: { value: '14:00' } });
  fireEvent.change(screen.getAllByPlaceholderText('Search city...')[1], { target: { value: 'Mumbai' } });
}

describe('Matching Page: Form', () => {
  beforeEach(() => {
    mockPush.mockReset();
    mockApiPost.mockReset();
    mockApiGet.mockReset();
    mockStoreState.accessToken = 'valid-token';
  });

  it('should render header "Kundli Matching"', () => {
    render(<MatchingPage />);
    expect(screen.getByText('Matching')).toBeDefined();
  });

  it('should render two person forms', () => {
    render(<MatchingPage />);
    expect(screen.getByText('Person A')).toBeDefined();
    expect(screen.getByText('Person B')).toBeDefined();
  });

  it('should disable Check Compatibility button when forms are incomplete', () => {
    render(<MatchingPage />);
    const button = screen.getByText('Check Compatibility');
    // The button stays clickable but is marked aria-disabled while invalid, so
    // a click can surface inline "required" errors and focus the first empty
    // field (instead of a dead disabled button giving no feedback).
    expect(button.getAttribute('aria-disabled')).toBe('true');
  });

  it('should show auth error when not logged in', async () => {
    mockStoreState.accessToken = null;
    render(<MatchingPage />);
    fillBothForms();
    fireEvent.click(screen.getByText('Check Compatibility'));
    expect(await screen.findByText('Please log in to use Kundli Matching.')).toBeDefined();
  });
});

describe('Matching Page: Results', () => {
  beforeEach(() => {
    mockPush.mockReset();
    mockApiPost.mockReset();
    mockApiGet.mockReset();
    mockStoreState.accessToken = 'valid-token';
  });

  it('should render compatibility results with score, percentage, and verdict', async () => {
    mockApiPost.mockResolvedValueOnce(mockMatchingResult);
    render(<MatchingPage />);
    fillBothForms();
    fireEvent.click(screen.getByText('Check Compatibility'));

    // Score: 28/36
    expect(await screen.findByText(/28/)).toBeDefined();
    expect(screen.getByText(/\/36/)).toBeDefined();
    // Percentage: Math.round((28/36)*100) = 78
    expect(screen.getByText('78%')).toBeDefined();
    // Verdict
    expect(screen.getByText('Good Match')).toBeDefined();
  });

  it('should render koota breakdown with all 8 kootas', async () => {
    mockApiPost.mockResolvedValueOnce(mockMatchingResult);
    render(<MatchingPage />);
    fillBothForms();
    fireEvent.click(screen.getByText('Check Compatibility'));

    expect(await screen.findByText('Varna')).toBeDefined();
    expect(screen.getByText('Vashya')).toBeDefined();
    expect(screen.getByText('Tara')).toBeDefined();
    expect(screen.getByText('Yoni')).toBeDefined();
    expect(screen.getByText('Graha Maitri')).toBeDefined();
    expect(screen.getByText('Gana')).toBeDefined();
    expect(screen.getByText('Bhakoot')).toBeDefined();
    expect(screen.getByText('Nadi')).toBeDefined();
  });

  it('should render analysis summary', async () => {
    mockApiPost.mockResolvedValueOnce(mockMatchingResult);
    render(<MatchingPage />);
    fillBothForms();
    fireEvent.click(screen.getByText('Check Compatibility'));

    expect(await screen.findByText('Analysis Summary')).toBeDefined();
    expect(screen.getByText('This is a favorable match.')).toBeDefined();
  });
});
