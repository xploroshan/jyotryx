/**
 * Muhurat Page Tests
 *
 * Validates rendering of purpose grid, date/location inputs, auth guard,
 * and auspicious times result display.
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
  accessToken: 'valid-token',
  refreshToken: 'valid-refresh',
  isAuthenticated: true,
  setAuth: vi.fn(),
  updateCredits: vi.fn(),
  logout: vi.fn(),
};

vi.mock('@/lib/store', () => ({
  useAuthStore: Object.assign(
    vi.fn((selector?: any) => selector ? selector(mockStoreState) : mockStoreState),
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

// ─── Mock muhurat result ────────────────────────────────────────────────────
const mockMuhuratResult = {
  purpose: 'marriage',
  auspiciousTimes: [
    { date: '2026-04-10', startTime: '9:00 AM', endTime: '11:30 AM', quality: 'excellent', reason: 'Jupiter-Venus conjunction in favorable nakshatra' },
    { date: '2026-04-12', startTime: '2:00 PM', endTime: '4:00 PM', quality: 'good', reason: 'Favorable tithi and panchang alignment' },
  ],
};

// ─── Import component AFTER mocks ──────────────────────────────────────────
import MuhuratPage from '@/app/muhurat/page';

describe('Muhurat Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStoreState.isAuthenticated = true;
    mockStoreState.accessToken = 'valid-token';
  });

  it('should render header "Muhurat Finder"', () => {
    render(<MuhuratPage />);
    expect(screen.getByText('Finder')).toBeDefined();
    expect(screen.getByText('Muhurat')).toBeDefined();
  });

  it('should render all 8 purpose options', () => {
    render(<MuhuratPage />);
    const purposes = [
      'Marriage', 'Business Start', 'Travel', 'Property Purchase',
      'Vehicle Purchase', 'Education', 'Puja / Ceremony', 'Housewarming',
    ];
    for (const purpose of purposes) {
      expect(screen.getByText(purpose)).toBeDefined();
    }
  });

  it('should render date and location inputs', () => {
    render(<MuhuratPage />);
    expect(screen.getByText('From Date')).toBeDefined();
    expect(screen.getByText('To Date')).toBeDefined();
    expect(screen.getByText('Location')).toBeDefined();
    expect(screen.getByPlaceholderText('e.g. Mumbai, India')).toBeDefined();
  });

  it('should redirect to /auth when not authenticated', async () => {
    mockStoreState.isAuthenticated = false;
    render(<MuhuratPage />);

    // Fill in required fields
    const locationInput = screen.getByPlaceholderText('e.g. Mumbai, India');
    fireEvent.change(locationInput, { target: { value: 'Delhi, India' } });

    const dateInputs = document.querySelectorAll('input[type="date"]');
    fireEvent.change(dateInputs[0], { target: { value: '2026-04-01' } });
    fireEvent.change(dateInputs[1], { target: { value: '2026-04-30' } });

    const submitButton = screen.getByText('Find Auspicious Times');
    fireEvent.click(submitButton);

    expect(mockPush).toHaveBeenCalledWith('/auth');
  });

  it('should render auspicious times results with dates, time ranges, and quality badges', async () => {
    mockApiPost.mockResolvedValueOnce(mockMuhuratResult);
    render(<MuhuratPage />);

    // Fill in required fields
    const locationInput = screen.getByPlaceholderText('e.g. Mumbai, India');
    fireEvent.change(locationInput, { target: { value: 'Mumbai, India' } });

    const dateInputs = document.querySelectorAll('input[type="date"]');
    fireEvent.change(dateInputs[0], { target: { value: '2026-04-01' } });
    fireEvent.change(dateInputs[1], { target: { value: '2026-04-30' } });

    const submitButton = screen.getByText('Find Auspicious Times');
    fireEvent.click(submitButton);

    // Wait for results to render
    expect(await screen.findByText('Excellent')).toBeDefined();
    expect(screen.getByText('Good')).toBeDefined();
    expect(screen.getByText('9:00 AM - 11:30 AM')).toBeDefined();
    expect(screen.getByText('2:00 PM - 4:00 PM')).toBeDefined();
    expect(screen.getByText('Jupiter-Venus conjunction in favorable nakshatra')).toBeDefined();
    expect(screen.getByText('Favorable tithi and panchang alignment')).toBeDefined();
  });
});
