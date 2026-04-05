/**
 * Kundli Page Tests
 *
 * Validates form rendering, auth guard on submit, and kundli result display.
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

// ─── Mock kundli result ─────────────────────────────────────────────────────
const mockKundliResult = {
  id: 'k1',
  ascendant: 'Aries',
  moonSign: 'Cancer',
  sunSign: 'Leo',
  nakshatra: 'Pushya',
  houses: [
    { house: 1, sign: 'Aries', planets: ['Sun', 'Mercury'] },
    { house: 2, sign: 'Taurus', planets: [] },
    { house: 3, sign: 'Gemini', planets: [] },
    { house: 4, sign: 'Cancer', planets: [] },
    { house: 5, sign: 'Leo', planets: [] },
    { house: 6, sign: 'Virgo', planets: [] },
    { house: 7, sign: 'Libra', planets: ['Saturn'] },
    { house: 8, sign: 'Scorpio', planets: [] },
    { house: 9, sign: 'Sagittarius', planets: [] },
    { house: 10, sign: 'Capricorn', planets: [] },
    { house: 11, sign: 'Aquarius', planets: [] },
    { house: 12, sign: 'Pisces', planets: [] },
  ],
  planetaryPositions: [
    { planet: 'Sun', sign: 'Leo', house: 1, degree: 15.5, isRetrograde: false, nakshatra: 'Magha' },
    { planet: 'Saturn', sign: 'Aquarius', house: 7, degree: 22.3, isRetrograde: true, nakshatra: 'Dhanishta' },
  ],
  dashas: [
    {
      planet: 'Venus',
      startDate: '2020-01-01',
      endDate: '2040-01-01',
      subPeriods: [{ planet: 'Sun', startDate: '2020-01-01', endDate: '2023-01-01' }],
    },
  ],
  yogas: [{ name: 'Gaja Kesari', description: 'Jupiter in kendra from Moon', effect: 'benefic' }],
};

// ─── Import component AFTER mocks ───────────────────────────────────────────
import KundliPage from '@/app/kundli/page';

// ─── Helper: fill all form fields ───────────────────────────────────────────
function fillForm() {
  fireEvent.change(screen.getByPlaceholderText('Enter your full name'), { target: { value: 'Rohan Sharma' } });
  // Labels don't have htmlFor, so query inputs by type within the form
  const dateInput = document.querySelector('input[type="date"]') as HTMLInputElement;
  const timeInput = document.querySelector('input[type="time"]') as HTMLInputElement;
  fireEvent.change(dateInput, { target: { value: '1990-05-15' } });
  fireEvent.change(timeInput, { target: { value: '10:30' } });
  fireEvent.change(screen.getByPlaceholderText('Search city...'), { target: { value: 'Delhi' } });
}

describe('Kundli Page: Form', () => {
  beforeEach(() => {
    mockPush.mockReset();
    mockApiPost.mockReset();
    mockApiGet.mockReset();
    mockStoreState.accessToken = 'valid-token';
  });

  it('should render form with all input fields', () => {
    render(<KundliPage />);
    expect(screen.getByPlaceholderText('Enter your full name')).toBeDefined();
    expect(screen.getByText('Date of Birth')).toBeDefined();
    expect(document.querySelector('input[type="date"]')).not.toBeNull();
    expect(screen.getByText('Time of Birth')).toBeDefined();
    expect(document.querySelector('input[type="time"]')).not.toBeNull();
    expect(screen.getByPlaceholderText('Search city...')).toBeDefined();
    expect(screen.getByText('Generate Kundli')).toBeDefined();
  });

  it('should disable Generate button when fields are empty', () => {
    render(<KundliPage />);
    const button = screen.getByText('Generate Kundli');
    expect((button as HTMLButtonElement).disabled).toBe(true);
  });

  it('should show error when not authenticated', async () => {
    mockStoreState.accessToken = null;
    render(<KundliPage />);
    fillForm();
    fireEvent.click(screen.getByText('Generate Kundli'));
    expect(await screen.findByText('Please log in to generate your Kundli.')).toBeDefined();
  });
});

describe('Kundli Page: Results', () => {
  beforeEach(() => {
    mockPush.mockReset();
    mockApiPost.mockReset();
    mockApiGet.mockReset();
    mockStoreState.accessToken = 'valid-token';
  });

  it('should render kundli results after generation', async () => {
    mockApiPost.mockResolvedValueOnce(mockKundliResult);
    mockApiGet.mockResolvedValueOnce({ doshas: [] });
    render(<KundliPage />);
    fillForm();
    fireEvent.click(screen.getByText('Generate Kundli'));

    expect(await screen.findByText(/Aries/)).toBeDefined();
    const body = document.body.textContent || '';
    expect(body).toContain('Cancer');
    expect(body).toContain('Leo');
    expect(body).toContain('Pushya');
  });

  it('should render tab navigation', async () => {
    mockApiPost.mockResolvedValueOnce(mockKundliResult);
    mockApiGet.mockResolvedValueOnce({ doshas: [] });
    render(<KundliPage />);
    fillForm();
    fireEvent.click(screen.getByText('Generate Kundli'));

    expect(await screen.findByText('Birth Chart')).toBeDefined();
    expect(screen.getByText('Planetary Details')).toBeDefined();
    expect(screen.getByText('House Analysis')).toBeDefined();
    expect(screen.getByText('Dasha Periods')).toBeDefined();
    expect(screen.getByText('Yogas')).toBeDefined();
    expect(screen.getByText('Doshas')).toBeDefined();
  });

  it('should render yoga card with name and effect', async () => {
    mockApiPost.mockResolvedValueOnce(mockKundliResult);
    mockApiGet.mockResolvedValueOnce({ doshas: [] });
    render(<KundliPage />);
    fillForm();
    fireEvent.click(screen.getByText('Generate Kundli'));

    // Wait for results then switch to Yogas tab
    await screen.findByText('Birth Chart');
    fireEvent.click(screen.getByText('Yogas'));

    expect(await screen.findByText('Gaja Kesari')).toBeDefined();
    expect(screen.getByText('Benefic')).toBeDefined();
    expect(screen.getByText('Jupiter in kendra from Moon')).toBeDefined();
  });
});
