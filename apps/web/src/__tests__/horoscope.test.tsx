/**
 * Horoscope Page Rendering Tests
 *
 * Validates that the Horoscope page renders correctly with mock data,
 * including zodiac grid, period tabs, and horoscope content sections.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';

// ─── Mock fetch ────────────────────────────────────────────────────────────
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// ─── Mock horoscope API response ───────────────────────────────────────────
const mockHoroscopeResponse = {
  prediction: 'The stars align in your favor today, bringing clarity and purpose.',
  love: 'Deep emotional connections are highlighted today.',
  career: 'Professional breakthroughs await with focused effort.',
  health: 'Your vitality is strong; maintain a balanced routine.',
  compatibility: 'Leo',
  mood: 'Positive',
  luckyNumber: 7,
  luckyColor: 'Purple',
};

// ─── Import component AFTER mocks ──────────────────────────────────────────
import HoroscopePage from '@/app/horoscope/page';

describe('Horoscope Page: Rendering', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it('should render header and zodiac grid with all 12 sign names', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify(mockHoroscopeResponse), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );
    render(<HoroscopePage />);

    const horoscopeEls = await screen.findAllByText(/Horoscope/);
    expect(horoscopeEls.length).toBeGreaterThanOrEqual(1);

    const signs = ['Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo', 'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces'];
    for (const sign of signs) {
      const els = screen.getAllByText(sign);
      expect(els.length).toBeGreaterThanOrEqual(1);
    }
  });

  it('should render selected sign info (Aries by default with date and element)', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify(mockHoroscopeResponse), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );
    render(<HoroscopePage />);

    // Aries is the default selected sign
    expect(await screen.findByText('Apr 14 - May 14')).toBeDefined();
    expect(screen.getByText('Fire')).toBeDefined();
  });

  it('should render period tabs (Daily, Weekly, Monthly, Yearly)', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify(mockHoroscopeResponse), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );
    render(<HoroscopePage />);

    expect(await screen.findByText('Daily')).toBeDefined();
    expect(screen.getByText('Weekly')).toBeDefined();
    expect(screen.getByText('Monthly')).toBeDefined();
    expect(screen.getByText('Yearly')).toBeDefined();
  });

  it('should render horoscope content after successful fetch', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify(mockHoroscopeResponse), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );
    render(<HoroscopePage />);

    // Overview content
    expect(await screen.findByText('The stars align in your favor today, bringing clarity and purpose.')).toBeDefined();

    // Lucky factors
    expect(screen.getByText('Lucky Factors')).toBeDefined();
    expect(screen.getByText('7')).toBeDefined();
    expect(screen.getByText('Purple')).toBeDefined();

    // Section headers
    expect(screen.getByText('Love & Relationships')).toBeDefined();
    expect(screen.getByText('Career & Finance')).toBeDefined();
    expect(screen.getByText('Health & Wellness')).toBeDefined();

    // Section content
    expect(screen.getByText('Deep emotional connections are highlighted today.')).toBeDefined();
    expect(screen.getByText('Professional breakthroughs await with focused effort.')).toBeDefined();
    expect(screen.getByText('Your vitality is strong; maintain a balanced routine.')).toBeDefined();
  });

  it('should render error message on fetch failure', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response('Internal Server Error', { status: 500 })
    );
    render(<HoroscopePage />);

    expect(await screen.findByText('Could not load horoscope. Please check your connection and try again.')).toBeDefined();
    expect(screen.getByText('Retry')).toBeDefined();
  });

  it('should show loading state', () => {
    // Never resolve fetch to keep loading state
    mockFetch.mockReturnValueOnce(new Promise(() => {}));
    render(<HoroscopePage />);

    // The loading spinner SVG should be in the document
    const spinner = document.querySelector('svg.animate-spin');
    expect(spinner).toBeDefined();
    expect(spinner).not.toBeNull();
  });
});
