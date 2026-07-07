/**
 * Panchang Page Rendering Tests
 *
 * Validates that the Panchang page renders correctly with mock data,
 * including panchang elements, timings, and inauspicious periods.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';

// ─── Mock fetch ────────────────────────────────────────────────────────────
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// ─── Mock panchang API response ────────────────────────────────────────────
const mockPanchangResponse = {
  date: '2026-04-05',
  tithi: 'Krishna Chaturthi',
  nakshatra: 'Ardra',
  yoga: 'Sadhya',
  karana: 'Balava',
  vara: 'Ravivaar (Sunday)',
  sunrise: '6:15 AM',
  sunset: '6:45 PM',
  moonrise: '9:30 PM',
  rahukaal: '4:30 PM - 6:00 PM',
  gulikakaal: '3:00 PM - 4:30 PM',
  yamakantaka: '12:00 PM - 1:30 PM',
};

// ─── Import component AFTER mocks ──────────────────────────────────────────
import PanchangPage from '@/app/panchang/PanchangClient';

describe('Panchang Page: Rendering', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it('should render header text', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify(mockPanchangResponse), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );
    render(<PanchangPage />);

    // The page H1 ('Panchang') moved to the server shell (page.tsx);
    // the client widget's own header content is the date card.
    expect(await screen.findByText('Tithi')).toBeDefined();
  });

  it('should render all panchang elements', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify(mockPanchangResponse), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );
    render(<PanchangPage />);

    expect(await screen.findByText('Krishna Chaturthi')).toBeDefined();
    expect(screen.getByText('Ardra')).toBeDefined();
    expect(screen.getByText('Sadhya')).toBeDefined();
    expect(screen.getByText('Balava')).toBeDefined();
    // Vara appears in both the date section and the panchang items
    const varaElements = screen.getAllByText('Ravivaar (Sunday)');
    expect(varaElements.length).toBeGreaterThanOrEqual(1);
  });

  it('should render timings (sunrise, sunset, moonrise)', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify(mockPanchangResponse), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );
    render(<PanchangPage />);

    expect(await screen.findByText('6:15 AM')).toBeDefined();
    expect(screen.getByText('6:45 PM')).toBeDefined();
    expect(screen.getByText('9:30 PM')).toBeDefined();

    // Labels
    expect(screen.getByText('Sunrise')).toBeDefined();
    expect(screen.getByText('Sunset')).toBeDefined();
    expect(screen.getByText('Moonrise')).toBeDefined();
  });

  it('should render inauspicious periods', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify(mockPanchangResponse), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );
    render(<PanchangPage />);

    expect(await screen.findByText('Rahu Kaal')).toBeDefined();
    expect(screen.getByText('4:30 PM - 6:00 PM')).toBeDefined();
    expect(screen.getByText('Gulika Kaal')).toBeDefined();
    expect(screen.getByText('3:00 PM - 4:30 PM')).toBeDefined();
    expect(screen.getByText('Yamakantaka')).toBeDefined();
    expect(screen.getByText('12:00 PM - 1:30 PM')).toBeDefined();
  });

  it('should render error on fetch failure', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response('Internal Server Error', { status: 500 })
    );
    render(<PanchangPage />);

    expect(await screen.findByText('Failed to fetch Panchang data')).toBeDefined();
    expect(screen.getByText('Retry')).toBeDefined();
  });

  it('should render date display', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify(mockPanchangResponse), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );
    render(<PanchangPage />);

    // The date is formatted using toLocaleDateString, check for the year at minimum
    expect(await screen.findByText(/2026/)).toBeDefined();
    expect(screen.getByText('Date')).toBeDefined();
  });
});
