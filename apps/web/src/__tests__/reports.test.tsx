/**
 * Reports Page Tests
 *
 * Validates auth redirect, header, tabs, report type cards,
 * history view, and PDF download link rendering.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';

// ─── Mock next/navigation ───────────────────────────────────────────────────
const mockPush = vi.fn();
const mockReplace = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace }),
  useSearchParams: () => ({ get: () => null }),
}));

// ─── Mock store state ───────────────────────────────────────────────────────
const mockStoreState = {
  user: { id: '1', name: 'Test User', email: 'test@test.com', credits: 10, role: 'user' },
  accessToken: 'valid-token',
  refreshToken: 'valid-refresh',
  isAuthenticated: true,
  isHydrated: true,
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

// ─── Mock reports list ─────────────────────────────────────────────────────
const mockReportsList = [
  {
    id: 'r1',
    type: 'LIFE',
    title: 'Life Analysis Report',
    status: 'completed',
    summary: 'Comprehensive life analysis',
    creditsCharged: 5,
    createdAt: '2026-04-01',
  },
];

// Full report (with sections) returned by GET /reports/:id when viewing.
const mockFullReport = {
  ...mockReportsList[0],
  sections: [
    { title: 'Birth Chart Overview', content: 'Your chart shows strong determination.', order: 1 },
    { title: 'Remedies', content: 'Practice meditation daily.', order: 2 },
  ],
};

// ─── Import component AFTER mocks ──────────────────────────────────────────
import ReportsPage from '@/app/reports/page';

describe('Reports Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStoreState.isAuthenticated = true;
    mockStoreState.accessToken = 'valid-token';
    // URL-aware default so usePricingConfig's extra /payments/pricing
    // fetch never starves the /reports list call. Per-test
    // mockResolvedValueOnce still wins for the very first call.
    mockApiGet.mockImplementation((url: string) => {
      if (url === '/payments/pricing') return Promise.resolve({});
      if (url === '/reports') return Promise.resolve(mockReportsList);
      return Promise.resolve(mockFullReport);
    });
  });

  it('should redirect to /auth when not authenticated', () => {
    mockStoreState.isAuthenticated = false;
    mockApiGet.mockResolvedValueOnce([]);
    render(<ReportsPage />);
    expect(mockPush).toHaveBeenCalledWith('/auth');
  });

  it('should render header "Your Reports"', async () => {
    mockApiGet.mockResolvedValueOnce(mockReportsList);
    render(<ReportsPage />);
    expect(screen.getByText('Reports')).toBeDefined();
    expect(screen.getByText('Your')).toBeDefined();
  });

  it('should render Generate New and My Reports tabs', async () => {
    mockApiGet.mockResolvedValueOnce(mockReportsList);
    render(<ReportsPage />);
    expect(await screen.findByText('Generate New')).toBeDefined();
    expect(screen.getByText(/My Reports/)).toBeDefined();
  });

  it('should render all 6 report type cards', async () => {
    mockApiGet.mockResolvedValueOnce(mockReportsList);
    render(<ReportsPage />);

    const reportTypes = [
      'Life Analysis', 'Career Outlook', 'Marriage Report',
      'Wealth Forecast', 'Palmistry Report', 'Annual Horoscope',
    ];
    for (const label of reportTypes) {
      expect(await screen.findByText(label)).toBeDefined();
    }
  });

  it('should render report in history view', async () => {
    mockApiGet.mockResolvedValueOnce(mockReportsList);
    render(<ReportsPage />);

    // Wait for reports to load, then switch to history tab
    const historyTab = await screen.findByText(/My Reports/);
    fireEvent.click(historyTab);

    expect(await screen.findByText('Life Analysis Report')).toBeDefined();
    expect(screen.getByText('completed')).toBeDefined();
    expect(screen.getByText('Comprehensive life analysis')).toBeDefined();
  });

  it('shows a View action for completed reports', async () => {
    mockApiGet.mockResolvedValueOnce(mockReportsList);
    render(<ReportsPage />);

    const historyTab = await screen.findByText(/My Reports/);
    fireEvent.click(historyTab);

    expect(await screen.findByText('View')).toBeDefined();
  });

  it('opens the in-app reader and renders section content on View', async () => {
    // List load returns the summary rows; any subsequent GET (the by-id
    // fetch) returns the full report with sections.
    mockApiGet.mockImplementation((url: string) =>
      Promise.resolve(url === '/reports' ? mockReportsList : mockFullReport),
    );
    render(<ReportsPage />);

    const historyTab = await screen.findByText(/My Reports/);
    fireEvent.click(historyTab);

    fireEvent.click(await screen.findByText('View'));

    expect(await screen.findByText('Birth Chart Overview')).toBeDefined();
    expect(screen.getByText('Your chart shows strong determination.')).toBeDefined();
    expect(screen.getByText('Remedies')).toBeDefined();
    // The reader fetched the full report via the by-id endpoint.
    expect(mockApiGet).toHaveBeenCalledWith('/reports/r1', expect.anything());
  });
});
