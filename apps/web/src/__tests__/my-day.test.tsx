/**
 * My Day Page Rendering Tests
 *
 * Validates that the My Day page renders correctly with mock data,
 * catching visual bugs like the \u2013 literal text issue.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
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
    vi.fn(() => mockStoreState),
    { getState: () => mockStoreState },
  ),
  useAuthHydrated: () => true,
}));

// ─── Mock API ───────────────────────────────────────────────────────────────
const mockBriefing = {
  greeting: 'Good Morning, Test!',
  date: '2026-04-05',
  dayQuality: 'good' as const,
  summary: 'A favorable day with positive energy.',
  doList: ['Meet authority figures', 'Leadership decisions'],
  avoidList: ['Starting partnerships', 'Lending money'],
  planetaryHours: [
    { planet: 'Saturn', startTime: '10:00 AM', endTime: '11:00 AM', activities: ['Long-term planning', 'Discipline tasks'], avoid: ['New beginnings'], isCurrent: false },
    { planet: 'Jupiter', startTime: '11:00 AM', endTime: '12:00 PM', activities: ['Teaching', 'Mentoring'], avoid: ['Risky speculation'], isCurrent: true },
    { planet: 'Mars', startTime: '12:00 PM', endTime: '1:00 PM', activities: ['Physical activities', 'Debugging'], avoid: ['Starting partnerships'], isCurrent: false },
    { planet: 'Sun', startTime: '1:00 PM', endTime: '2:00 PM', activities: ['Meet authority figures'], avoid: ['Lending money'], isCurrent: false },
    { planet: 'Venus', startTime: '2:00 PM', endTime: '3:00 PM', activities: ['Client relationships'], avoid: ['Aggressive negotiations'], isCurrent: false },
    { planet: 'Mercury', startTime: '3:00 PM', endTime: '4:00 PM', activities: ['Communication', 'Writing'], avoid: ['Long-term commitments'], isCurrent: false },
  ],
  currentHora: { planet: 'Jupiter', startTime: '11:00 AM', endTime: '12:00 PM', activities: ['Teaching', 'Mentoring', 'Financial planning'], avoid: ['Risky speculation'], isCurrent: true },
  luckyColor: 'Ruby Red',
  luckyNumber: 6,
  luckyTime: '11:00 AM - 12:00 PM',
  professionInsight: 'Great for system design and mentoring juniors.',
  remedy: 'Visit a temple and offer yellow flowers.',
  mantra: 'Om Suryaya Namaha',
  panchang: {
    tithi: 'Krishna Chaturthi',
    nakshatra: 'Ardra',
    yoga: 'Sadhya',
    vara: 'Ravivaar (Sunday)',
    rahukaal: '4:30 PM - 6:00 PM',
  },
  transitAlert: null,
};

const mockApiGet = vi.fn();
vi.mock('@/lib/api', () => ({
  api: {
    get: (...args: any[]) => mockApiGet(...args),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    upload: vi.fn(),
  },
}));

// ─── Import component AFTER mocks ───────────────────────────────────────────
import MyDayPage from '@/app/my-day/page';

describe('My Day Page: Rendering', () => {
  beforeEach(() => {
    mockPush.mockReset();
    mockApiGet.mockReset();
    mockApiGet.mockResolvedValue(mockBriefing);
    mockStoreState.isAuthenticated = true;
    // Pin wall clock to 11:30 AM local so the page's live-clock
    // `currentHourIndex` lands inside Jupiter's 11 AM-12 PM slot in
    // the fixture. Without this the "NOW" hora depends on when the
    // test happens to run and fixture-based planet assertions become
    // flaky any time the real clock falls between 10 AM and 4 PM.
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const pinned = new Date();
    pinned.setHours(11, 30, 0, 0);
    vi.setSystemTime(pinned);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should render greeting text', async () => {
    render(<MyDayPage />);
    const greeting = await screen.findByText('Good Morning, Test!');
    expect(greeting).toBeDefined();
  });

  it('should render panchang data correctly', async () => {
    render(<MyDayPage />);
    expect(await screen.findByText('Krishna Chaturthi')).toBeDefined();
    expect(screen.getByText('Ardra')).toBeDefined();
    expect(screen.getByText('Sadhya')).toBeDefined();
    expect(screen.getByText('Ravivaar (Sunday)')).toBeDefined();
    expect(screen.getByText('4:30 PM - 6:00 PM')).toBeDefined();
  });

  it('should render current hora planet', async () => {
    render(<MyDayPage />);
    // Jupiter should appear as current hora
    const jupiterElements = await screen.findAllByText('Jupiter');
    expect(jupiterElements.length).toBeGreaterThanOrEqual(1);
  });

  it('should render time ranges with actual en-dash, not \\u2013 literal', async () => {
    render(<MyDayPage />);
    await screen.findByText('Good Morning, Test!');

    // The bug: \u2013 was rendered as literal text instead of –
    // Check that no element contains the literal string "\u2013"
    const body = document.body.textContent || '';
    expect(body).not.toContain('\\u2013');
    expect(body).not.toContain('u2013');

    // Time ranges should contain actual en-dash or hyphen
    expect(body).toContain('11:00 AM');
    expect(body).toContain('12:00 PM');
  });

  it('should render lucky color and number', async () => {
    render(<MyDayPage />);
    expect(await screen.findByText('Ruby Red')).toBeDefined();
    // Lucky number appears twice (in the icon and label)
    const sixes = screen.getAllByText('6');
    expect(sixes.length).toBeGreaterThanOrEqual(1);
  });

  it('should render do and avoid lists', async () => {
    render(<MyDayPage />);
    const doItems = await screen.findAllByText('Meet authority figures');
    expect(doItems.length).toBeGreaterThanOrEqual(1);
    const avoidItems = screen.getAllByText('Lending money');
    expect(avoidItems.length).toBeGreaterThanOrEqual(1);
  });

  it('should render mantra', async () => {
    render(<MyDayPage />);
    expect(await screen.findByText('Om Suryaya Namaha')).toBeDefined();
  });

  it('should render remedy', async () => {
    render(<MyDayPage />);
    expect(await screen.findByText('Visit a temple and offer yellow flowers.')).toBeDefined();
  });

  it('should render day quality badge', async () => {
    render(<MyDayPage />);
    expect(await screen.findByText('Good Day')).toBeDefined();
  });

  it('should render profession insight', async () => {
    render(<MyDayPage />);
    expect(await screen.findByText(/system design/)).toBeDefined();
  });

  it('should render NOW badge on current hora', async () => {
    render(<MyDayPage />);
    expect(await screen.findByText('NOW')).toBeDefined();
  });

  it('should render planetary hour activities', async () => {
    render(<MyDayPage />);
    await screen.findByText('Good Morning, Test!');
    const body = document.body.textContent || '';
    expect(body).toContain('Teaching');
    expect(body).toContain('Mentoring');
  });

  it('should show all planet names in planetary hours section', async () => {
    render(<MyDayPage />);
    await screen.findByText('Good Morning, Test!');
    // The section opens with a wall-clock-anchored window showing the
    // current hour + a few future hours. Expand to "View all 24" so the
    // assertions don't depend on what time the test runs at.
    fireEvent.click(await screen.findByText('View all 24'));
    const body = document.body.textContent || '';
    expect(body).toContain('Saturn');
    expect(body).toContain('Jupiter');
    expect(body).toContain('Mars');
    expect(body).toContain('Sun');
    expect(body).toContain('Venus');
    expect(body).toContain('Mercury');
  });

  it('should not render transit alert when null', async () => {
    render(<MyDayPage />);
    await screen.findByText('Good Morning, Test!');
    expect(screen.queryByText('Planetary Transit')).toBeNull();
  });
});

describe('My Day Page: Personalization prompt', () => {
  beforeEach(() => {
    mockPush.mockReset();
    mockApiGet.mockReset();
    mockStoreState.isAuthenticated = true;
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const pinned = new Date();
    pinned.setHours(11, 30, 0, 0);
    vi.setSystemTime(pinned);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows the "make this your reading" prompt when the chart layer is dark (missing time)', async () => {
    mockApiGet.mockResolvedValue({ ...mockBriefing, personalized: false, personalizationReason: 'missing_time', moonSign: null });
    render(<MyDayPage />);
    expect(await screen.findByText('Make this your reading')).toBeDefined();
    // Reason-specific copy for a missing birth time.
    expect(screen.getByText(/exact birth time/)).toBeDefined();
    // The CTA links to the profile so the user can complete their details.
    const cta = screen.getByText('Complete birth details');
    expect(cta.closest('a')?.getAttribute('href')).toBe('/profile');
  });

  it('shows the missing-place copy when the birthplace is not geocoded', async () => {
    mockApiGet.mockResolvedValue({ ...mockBriefing, personalized: false, personalizationReason: 'missing_place', moonSign: null });
    render(<MyDayPage />);
    await screen.findByText('Make this your reading');
    expect(screen.getByText(/birthplace/)).toBeDefined();
  });

  it('shows the no-data copy when there is no birth date at all', async () => {
    mockApiGet.mockResolvedValue({ ...mockBriefing, personalized: false, personalizationReason: 'no_birth_data', moonSign: null });
    render(<MyDayPage />);
    await screen.findByText('Make this your reading');
    expect(screen.getByText(/birth date, exact time and place/)).toBeDefined();
  });

  it('does NOT show the prompt for a transient unavailable reason (user has complete data)', async () => {
    // An ephemeris outage isn't the user's fault — telling them to "add birth
    // details" they already have would be misleading, so we stay silent.
    mockApiGet.mockResolvedValue({ ...mockBriefing, personalized: false, personalizationReason: 'unavailable', moonSign: null });
    render(<MyDayPage />);
    await screen.findByText('Good Morning, Test!');
    expect(screen.queryByText('Make this your reading')).toBeNull();
  });

  it('does NOT show the prompt — and shows the Moon-sign badge — when the reading is personalized', async () => {
    mockApiGet.mockResolvedValue({ ...mockBriefing, personalized: true, personalizationReason: 'ok', moonSign: 'Cancer' });
    render(<MyDayPage />);
    await screen.findByText('Good Morning, Test!');
    expect(screen.queryByText('Make this your reading')).toBeNull();
    // The natal Moon-sign badge marks the reading as chart-derived.
    expect(screen.getByText('Cancer')).toBeDefined();
  });
});

describe('My Day Page: Auth Guard', () => {
  it('should redirect to /auth when not authenticated', () => {
    const originalAuth = mockStoreState.isAuthenticated;
    mockStoreState.isAuthenticated = false;

    render(<MyDayPage />);

    expect(mockPush).toHaveBeenCalledWith('/auth');
    mockStoreState.isAuthenticated = originalAuth;
  });
});
