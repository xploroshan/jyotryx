/**
 * Numerology Page Rendering Tests
 *
 * Validates that the Numerology page renders correctly with mock data,
 * including name analysis, brand analysis, tabs, and error handling.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';

// ─── Mock API ─────────────────────────────────────────────────────────────
const mockApiPost = vi.fn();

vi.mock('@/lib/api', () => ({
  api: {
    get: vi.fn(),
    post: (...args: any[]) => mockApiPost(...args),
    put: vi.fn(),
    delete: vi.fn(),
    upload: vi.fn(),
  },
}));

// ─── Mock name result ─────────────────────────────────────────────────────
const mockNameResult = {
  name: 'Arjun Sharma',
  destinyNumber: 7,
  soulNumber: 3,
  personalityNumber: 4,
  destinyMeaning: 'Spiritual seeker with deep analytical mind',
  soulMeaning: 'Creative expression and joy',
  personalityMeaning: 'Disciplined and reliable exterior',
  overallVerdict: 'favorable',
  strengths: ['Strong intuition', 'Analytical mind'],
  cautions: ['Tendency to overthink', 'Can be withdrawn'],
  bestDaysToUse: ['Monday', 'Thursday'],
  luckyColors: ['Purple', 'White'],
  rulingPlanet: 'Ketu',
  compatibility: 'Numbers 1, 5, 6',
  suggestion: 'This name carries positive vibrations for spiritual growth.',
};

// ─── Mock brand result ────────────────────────────────────────────────────
const mockBrandResult = {
  brandName: 'TechNova',
  nameNumber: 5,
  vibration: 'Dynamic and versatile',
  planetaryRuler: 'Mercury',
  suitableFor: ['Technology', 'Communication'],
  avoidFor: ['Agriculture', 'Mining'],
  overallScore: 8,
  recommendation: 'Excellent name for a tech company.',
  alternativeNumbers: [1, 3],
  bestLaunchDays: ['Wednesday', 'Friday'],
  luckyColors: ['Green', 'Blue'],
};

// ─── Import component AFTER mocks ─────────────────────────────────────────
import NumerologyPage from '@/app/numerology/page';

describe('Numerology Page: Rendering', () => {
  beforeEach(() => {
    mockApiPost.mockReset();
  });

  it('should render header "Numerology Analyzer"', () => {
    render(<NumerologyPage />);
    expect(screen.getByText('Analyzer')).toBeDefined();
    // The editorial hero renders "Numerology" in more than one place
    // (eyebrow label + title), so assert presence rather than uniqueness.
    expect(screen.getAllByText('Numerology').length).toBeGreaterThan(0);
  });

  it('should render Name Analysis and Brand / Business tabs', () => {
    render(<NumerologyPage />);
    expect(screen.getByText('Name Analysis')).toBeDefined();
    expect(screen.getByText('Brand / Business')).toBeDefined();
  });

  it('should render name input and analyze button', () => {
    render(<NumerologyPage />);
    expect(screen.getByPlaceholderText('e.g., Arjun Sharma')).toBeDefined();
    expect(screen.getByText('Analyze')).toBeDefined();
  });

  it('should render name analysis results', async () => {
    mockApiPost.mockResolvedValueOnce(mockNameResult);

    render(<NumerologyPage />);

    // Enter name and click analyze
    const input = screen.getByPlaceholderText('e.g., Arjun Sharma');
    fireEvent.change(input, { target: { value: 'Arjun Sharma' } });
    fireEvent.click(screen.getByText('Analyze'));

    // Check destiny/soul/personality numbers
    expect(await screen.findByText('Destiny Number')).toBeDefined();
    expect(screen.getByText('Soul Number')).toBeDefined();
    expect(screen.getByText('Personality Number')).toBeDefined();
    expect(screen.getByText('7')).toBeDefined();
    expect(screen.getByText('3')).toBeDefined();
    expect(screen.getByText('4')).toBeDefined();

    // Check strengths
    expect(screen.getByText('Strengths')).toBeDefined();
    expect(screen.getByText('Strong intuition')).toBeDefined();
    expect(screen.getByText('Analytical mind')).toBeDefined();

    // Check cautions
    expect(screen.getByText('Cautions')).toBeDefined();
    expect(screen.getByText('Tendency to overthink')).toBeDefined();
    expect(screen.getByText('Can be withdrawn')).toBeDefined();
  });

  it('should show verdict badge (Favorable)', async () => {
    mockApiPost.mockResolvedValueOnce(mockNameResult);

    render(<NumerologyPage />);

    const input = screen.getByPlaceholderText('e.g., Arjun Sharma');
    fireEvent.change(input, { target: { value: 'Arjun Sharma' } });
    fireEvent.click(screen.getByText('Analyze'));

    expect(await screen.findByText('Favorable')).toBeDefined();
  });

  it('should render brand analysis results after switching tab', async () => {
    mockApiPost.mockResolvedValueOnce(mockBrandResult);

    render(<NumerologyPage />);

    // Switch to brand tab
    fireEvent.click(screen.getByText('Brand / Business'));

    // Enter brand name and analyze
    const input = screen.getByPlaceholderText('e.g., TechNova Solutions');
    fireEvent.change(input, { target: { value: 'TechNova' } });
    fireEvent.click(screen.getByText('Analyze'));

    // Check name number and business score
    expect(await screen.findByText('Name Number')).toBeDefined();
    expect(screen.getByText('Business Score')).toBeDefined();
    expect(screen.getByText('5')).toBeDefined();

    // Check recommendation
    expect(screen.getByText('Excellent name for a tech company.')).toBeDefined();

    // Check suitable/avoid industries
    expect(screen.getByText('Technology')).toBeDefined();
    expect(screen.getByText('Communication')).toBeDefined();
    expect(screen.getByText('Agriculture')).toBeDefined();
    expect(screen.getByText('Mining')).toBeDefined();

    // Check lucky info
    expect(screen.getByText('Wednesday, Friday')).toBeDefined();
    expect(screen.getByText('Green, Blue')).toBeDefined();
  });

  it('should show error on API failure', async () => {
    mockApiPost.mockRejectedValueOnce(new Error('Analysis failed'));

    render(<NumerologyPage />);

    const input = screen.getByPlaceholderText('e.g., Arjun Sharma');
    fireEvent.change(input, { target: { value: 'Arjun Sharma' } });
    fireEvent.click(screen.getByText('Analyze'));

    expect(await screen.findByText('Analysis failed')).toBeDefined();
  });
});
