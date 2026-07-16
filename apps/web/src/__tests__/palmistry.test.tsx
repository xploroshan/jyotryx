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
  useAuthHydrated: () => true,
}));

// ─── Mock API (dynamic import pattern) ────────────────────────────────────
const mockApiUpload = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => ({ get: () => null }),
}));

vi.mock('@/lib/api', () => ({
  api: {
    // usePricingConfig fetches /payments/pricing — return an empty config
    // so it resolves to defaults instead of throwing on undefined.
    get: vi.fn(() => Promise.resolve({})),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    upload: (...args: any[]) => mockApiUpload(...args),
  },
}));

// image-prep needs real image decoding (jsdom has no codecs) — it has its own
// unit suite; here we pass the file through untouched so the page flow runs.
vi.mock('@/lib/image-prep', () => ({
  prepareImage: vi.fn(async (file: File) => ({
    file,
    dataUrl: 'data:image/jpeg;base64,ZmFrZQ==',
    width: 1024,
    height: 768,
  })),
  ImagePrepError: class ImagePrepError extends Error {
    constructor(public code: string) {
      super(code);
      this.name = 'ImagePrepError';
    }
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
    const analyzeButton = await screen.findByText(/Analyze Palm/);
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
    const analyzeButton = await screen.findByText(/Analyze Palm/);
    fireEvent.click(analyzeButton);

    // Check results heading
    expect(await screen.findByText('Palm Analysis Results')).toBeDefined();

    // Check tabs
    expect(screen.getByText('Major Lines')).toBeDefined();
    expect(screen.getByText('Minor Lines')).toBeDefined();
    expect(screen.getByText('Mounts')).toBeDefined();
    expect(screen.getByText('Insights')).toBeDefined();

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
    const analyzeButton = await screen.findByText(/Analyze Palm/);
    fireEvent.click(analyzeButton);

    // Wait for results and check PalmDiagram
    await screen.findByText('Palm Analysis Results');
    const diagram = screen.getByTestId('palm-diagram');
    expect(diagram).toBeDefined();
    expect(diagram.textContent).toBe('analysis-loaded');
  });
});

describe('Palmistry Page: Wireframe + authenticity', () => {
  async function analyze(result: any) {
    mockApiUpload.mockResolvedValueOnce(result);
    const { container } = render(<PalmistryPage />);
    const file = new File(['fake-image-data'], 'palm.png', { type: 'image/png' });
    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(fileInput, { target: { files: [file] } });
    fireEvent.click(await screen.findByText(/Analyze Palm/));
    await screen.findByText('Palm Analysis Results');
    return container;
  }

  const geometryResult = {
    ...mockAnalysisResult,
    geometry: {
      landmarks: Array.from({ length: 21 }, (_, i) => ({ x: 0.3 + (i % 5) * 0.1, y: 0.2 + Math.floor(i / 5) * 0.15, z: 0 })),
      handedness: 'Right',
      score: 0.97,
      metrics: { palmAspect: 0.91, fingerRatio: 0.8, handShape: 'Air' },
      polylines: [
        { name: 'Heart Line', kind: 'major', points: [[0.2, 0.4], [0.4, 0.38], [0.6, 0.4], [0.8, 0.45]], confidence: 0.9 },
        { name: 'Head Line', kind: 'major', points: [[0.2, 0.5], [0.5, 0.5], [0.8, 0.55]], confidence: 0.85 },
        { name: 'Girdle of Venus', kind: 'minor', points: [[0.3, 0.3], [0.5, 0.28], [0.7, 0.3]], confidence: 0.6 },
      ],
    },
    verification: {
      verificationId: 'VERIF-abc123xyz',
      groundednessScore: 0.86,
      authentic: true,
      checks: [{ code: 'handShape.type', expected: 'Air', observed: 'Air', pass: true }],
    },
    factors: [
      { code: 'measurement.handShape.Air', label: 'Measured hand shape: Air', contribution: 'neutral', source: 'measurement' },
      { code: 'line.heart_line.strong', label: 'Heart Line: strong', contribution: 'positive', source: 'line' },
    ],
  };

  it('renders the neon wireframe (not the static diagram) when geometry exists', async () => {
    const container = await analyze(geometryResult);
    // Wireframe title + crisp SVG label for a traced line.
    expect(screen.getByText(/Your Palm — Scan/)).toBeDefined();
    expect(screen.getByText('HEART LINE')).toBeDefined();
    // Real SVG paths exist; the mocked PalmDiagram is NOT used.
    expect(container.querySelectorAll('svg path').length).toBeGreaterThan(2);
    expect(screen.queryByTestId('palm-diagram')).toBeNull();
  });

  it('shows the verification badge with id and groundedness', async () => {
    await analyze(geometryResult);
    expect(screen.getByText('Verified reading')).toBeDefined();
    expect(screen.getByText(/VERIF-abc123xyz/)).toBeDefined();
    expect(screen.getByText(/86%/)).toBeDefined();
  });

  it('renders Show Your Work with measured + observed factors', async () => {
    await analyze(geometryResult);
    expect(screen.getByText('Measured hand shape: Air')).toBeDefined();
    expect(screen.getByText('Heart Line: strong')).toBeDefined();
  });

  it('shows the sample-reading banner when the reading is not authentic', async () => {
    await analyze({
      ...mockAnalysisResult,
      verification: { verificationId: 'v', groundednessScore: 0, authentic: false, authenticReason: 'no_image', checks: [] },
    });
    expect(screen.getByText('Sample reading')).toBeDefined();
    expect(screen.queryByText('Verified reading')).toBeNull();
  });

  it('shows the duplicate soft-flag when the same photo was analysed before', async () => {
    await analyze({
      ...geometryResult,
      verification: {
        ...geometryResult.verification,
        duplicateOf: { readingId: 'r-1', createdAt: '2026-07-01T00:00:00Z' },
      },
    });
    expect(screen.getByText(/previously analysed on/)).toBeDefined();
  });

  it('falls back to the static PalmDiagram when no geometry came back', async () => {
    await analyze({ ...mockAnalysisResult });
    expect(screen.getByTestId('palm-diagram')).toBeDefined();
    expect(screen.queryByText(/Your Palm — Scan/)).toBeNull();
  });
});
