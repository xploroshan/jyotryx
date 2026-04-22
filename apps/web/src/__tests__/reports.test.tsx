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
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
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
    pdfUrl: 'https://example.com/report.pdf',
    creditsCharged: 5,
    createdAt: '2026-04-01',
  },
];

// ─── Import component AFTER mocks ──────────────────────────────────────────
import ReportsPage from '@/app/reports/page';

describe('Reports Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStoreState.isAuthenticated = true;
    mockStoreState.accessToken = 'valid-token';
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

  it('should show Download PDF link when pdfUrl exists', async () => {
    mockApiGet.mockResolvedValueOnce(mockReportsList);
    render(<ReportsPage />);

    // Switch to history tab
    const historyTab = await screen.findByText(/My Reports/);
    fireEvent.click(historyTab);

    const pdfLink = await screen.findByText('Download PDF');
    expect(pdfLink).toBeDefined();
    expect(pdfLink.closest('a')?.getAttribute('href')).toBe('https://example.com/report.pdf');
  });
});
