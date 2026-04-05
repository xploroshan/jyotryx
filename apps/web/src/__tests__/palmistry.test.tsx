/**
 * Palmistry Page Rendering Tests
 *
 * Validates that the Palmistry page renders correctly with mock data,
 * including gender selection, file upload, analysis results, and PalmDiagram.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';

// ─── Mock PalmDiagram ─────────────────────────────────────────────────────
vi.mock('@/components/palmistry/PalmDiagram', () => ({
  __esModule: true,
  default: ({ analysis, onFeatureSelect, selectedFeature }: any) =>
    React.createElement('div', { 'data-testid': 'palm-diagram' }, analysis ? 'analysis-loaded' : 'no-analysis'),
}));

// ─── Mock store (dynamic import pattern) ──────────────────────────────────
const mockStoreState = {
  accessToken: 'valid-token',
  user: { id: '1', name: 'Test User', email: 'test@example.com' },
  setAccessToken: vi.fn(),
  setUser: vi.fn(),
  logout: vi.fn(),
};

vi.mock('@/lib/store', () => ({
  useAuthStore: Object.assign(vi.fn(() => mockStoreState), {
    getState: () => mockStoreState,
  }),
}));

// ─── Mock API (dynamic import pattern) ────────────────────────────────────
const mockApiUpload = vi.fn();

vi.mock('@/lib/api', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    upload: (...args: any[]) => mockApiUpload(...args),
  },
}));

// ─── Mock analysis result ─────────────────────────────────────────────────
const mockAnalysisResult = {
  lines: [
    { name: 'Heart Line', interpretation: 'Deep emotional nature', strength: 'strong' },
    { name: 'Head Line', interpretation: 'Analytical thinking', strength: 'moderate' },
    { name: 'Life Line', interpretation: 'Strong vitality', strength: 'strong' },
    { name: 'Marriage Line', interpretation: 'One significant relationship', strength: 'moderate' },
  ],
  mounts: [
    { name: 'Mount of Jupiter', interpretation: 'Leadership qualities', prominence: 'elevated' },
    { name: 'Mount of Venus', interpretation: 'Warmth and love', prominence: 'normal' },
  ],
  overallReading: 'Natural leader with strong drive',
  healthInsights: 'Good physical constitution',
  careerInsights: 'Suited for leadership roles',
  relationshipInsights: 'Loyal and passionate partner',
  fingerAnalysis: [],
};

// ─── Import component AFTER mocks ─────────────────────────────────────────
import PalmistryPage from '@/app/palmistry/page';

describe('Palmistry Page: Rendering', () => {
  beforeEach(() => {
    mockApiUpload.mockReset();
    mockStoreState.accessToken = 'valid-token';
  });

  it('should render header "Palm Reading"', () => {
    render(<PalmistryPage />);
    expect(screen.getByText('Reading')).toBeDefined();
    expect(screen.getByText('Palm')).toBeDefined();
  });

  it('should render gender selection buttons', () => {
    render(<PalmistryPage />);
    expect(screen.getByText('Male — Right Palm')).toBeDefined();
    expect(screen.getByText('Female — Left Palm')).toBeDefined();
  });

  it('should show upload area with guidance text', () => {
    render(<PalmistryPage />);
    expect(screen.getByText('Use good lighting, open palm, clear focus')).toBeDefined();
  });

  it('should show "Please log in" error when not authenticated', async () => {
    mockStoreState.accessToken = null as any;

    const { container } = render(<PalmistryPage />);

    // Simulate file upload
    const file = new File(['fake-image-data'], 'palm.png', { type: 'image/png' });
    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(fileInput, { target: { files: [file] } });

    // Click analyze button
    const analyzeButton = await screen.findByText('Analyze Palm');
    fireEvent.click(analyzeButton);

    expect(await screen.findByText('Please log in to analyze your palm.')).toBeDefined();
  });

  it('should render analysis results after upload and analyze', async () => {
    mockApiUpload.mockResolvedValueOnce(mockAnalysisResult);

    const { container } = render(<PalmistryPage />);

    // Simulate file upload
    const file = new File(['fake-image-data'], 'palm.png', { type: 'image/png' });
    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(fileInput, { target: { files: [file] } });

    // Click analyze button
    const analyzeButton = await screen.findByText('Analyze Palm');
    fireEvent.click(analyzeButton);

    // Check results heading
    expect(await screen.findByText('Palm Analysis Results')).toBeDefined();

    // Check tabs
    expect(screen.getByText('Major Lines')).toBeDefined();
    expect(screen.getByText('Minor Lines')).toBeDefined();
    expect(screen.getByText('Mounts')).toBeDefined();
    expect(screen.getByText('Personality')).toBeDefined();

    // Check major line names
    expect(screen.getByText('Heart Line')).toBeDefined();
    expect(screen.getByText('Head Line')).toBeDefined();
    expect(screen.getByText('Life Line')).toBeDefined();
  });

  it('should render PalmDiagram component', async () => {
    mockApiUpload.mockResolvedValueOnce(mockAnalysisResult);

    const { container } = render(<PalmistryPage />);

    // Simulate file upload
    const file = new File(['fake-image-data'], 'palm.png', { type: 'image/png' });
    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(fileInput, { target: { files: [file] } });

    // Click analyze button
    const analyzeButton = await screen.findByText('Analyze Palm');
    fireEvent.click(analyzeButton);

    // Wait for results and check PalmDiagram
    await screen.findByText('Palm Analysis Results');
    const diagram = screen.getByTestId('palm-diagram');
    expect(diagram).toBeDefined();
    expect(diagram.textContent).toBe('analysis-loaded');
  });
});
