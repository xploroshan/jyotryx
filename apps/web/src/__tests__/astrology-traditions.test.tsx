/**
 * Astrology Traditions — Frontend Unit Tests
 *
 * Tests the AstrologyTraditionSelector component, tradition-aware
 * horoscope page rendering, and the auth store's tradition management.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import React from 'react';

// ─── Mock fetch globally ──────────────────────────────────────────────────────
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// ─── Auth Store Tradition Tests ─────────────────────────────────────────────

describe('Auth Store — Astrology Traditions', () => {
  // We test the store logic directly by importing and manipulating it
  beforeEach(async () => {
    const { useAuthStore } = await import('@/lib/store');
    // Reset the store between tests
    useAuthStore.setState({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
    });
  });

  it('should include astrologyTraditions in User interface', async () => {
    const { useAuthStore } = await import('@/lib/store');
    const mockUser = {
      id: 'test-1',
      name: 'Test',
      email: 'test@test.com',
      credits: 10,
      role: 'USER',
      preferredLanguage: 'en',
      astrologyTraditions: ['VEDIC', 'WESTERN'],
      profileComplete: true,
    };

    act(() => {
      useAuthStore.getState().setAuth(mockUser, 'token', 'refresh');
    });

    const state = useAuthStore.getState();
    expect(state.user?.astrologyTraditions).toEqual(['VEDIC', 'WESTERN']);
  });

  it('updateAstrologyTraditions should update the user traditions', async () => {
    const { useAuthStore } = await import('@/lib/store');
    const mockUser = {
      id: 'test-1',
      name: 'Test',
      email: 'test@test.com',
      credits: 10,
      role: 'USER',
      preferredLanguage: 'en',
      astrologyTraditions: ['VEDIC'],
      profileComplete: true,
    };

    act(() => {
      useAuthStore.getState().setAuth(mockUser, 'token', 'refresh');
    });

    act(() => {
      useAuthStore.getState().updateAstrologyTraditions(['VEDIC', 'CHINESE']);
    });

    expect(useAuthStore.getState().user?.astrologyTraditions).toEqual(['VEDIC', 'CHINESE']);
  });

  it('updateAstrologyTraditions should do nothing when user is null', async () => {
    const { useAuthStore } = await import('@/lib/store');

    act(() => {
      useAuthStore.getState().updateAstrologyTraditions(['WESTERN']);
    });

    expect(useAuthStore.getState().user).toBeNull();
  });
});

// ─── AstrologyTraditionSelector Component Tests ─────────────────────────────

describe('AstrologyTraditionSelector', () => {
  let AstrologyTraditionSelector: any;

  beforeEach(async () => {
    mockFetch.mockReset();
    const mod = await import('@/components/ui/AstrologyTraditionSelector');
    AstrologyTraditionSelector = mod.default;
  });

  it('should render all 6 tradition cards', () => {
    const onChange = vi.fn();
    render(<AstrologyTraditionSelector value={['VEDIC']} onChange={onChange} />);

    // Available traditions
    expect(screen.getByText('Vedic / Jyotish')).toBeDefined();
    expect(screen.getByText('Western Astrology')).toBeDefined();
    expect(screen.getByText('Chinese Astrology')).toBeDefined();

    // Coming soon traditions
    expect(screen.getByText('Hellenistic')).toBeDefined();
    expect(screen.getByText('Horary')).toBeDefined();
    expect(screen.getByText('Medical')).toBeDefined();
  });

  it('should show descriptions for each tradition', () => {
    const onChange = vi.fn();
    render(<AstrologyTraditionSelector value={['VEDIC']} onChange={onChange} />);

    expect(screen.getByText(/sidereal zodiac/i)).toBeDefined();
    expect(screen.getByText(/Tropical zodiac/i)).toBeDefined();
    expect(screen.getByText(/12 animal signs/i)).toBeDefined();
  });

  it('should mark selected traditions with checkmark', () => {
    const onChange = vi.fn();
    const { container } = render(
      <AstrologyTraditionSelector value={['VEDIC', 'WESTERN']} onChange={onChange} />
    );

    // Check for check SVG paths (the checkmark indicator)
    const checkmarks = container.querySelectorAll('path[d*="M5 13l4 4L19 7"]');
    expect(checkmarks.length).toBe(2); // VEDIC and WESTERN selected
  });

  it('should call onChange with added tradition when clicking unselected', () => {
    const onChange = vi.fn();
    render(<AstrologyTraditionSelector value={['VEDIC']} onChange={onChange} />);

    const westernCard = screen.getByText('Western Astrology').closest('button')!;
    fireEvent.click(westernCard);

    expect(onChange).toHaveBeenCalledWith(['VEDIC', 'WESTERN']);
  });

  it('should call onChange with removed tradition when clicking selected', () => {
    const onChange = vi.fn();
    render(
      <AstrologyTraditionSelector value={['VEDIC', 'WESTERN']} onChange={onChange} />
    );

    const westernCard = screen.getByText('Western Astrology').closest('button')!;
    fireEvent.click(westernCard);

    expect(onChange).toHaveBeenCalledWith(['VEDIC']);
  });

  it('should show error when trying to deselect the last tradition', () => {
    const onChange = vi.fn();
    render(<AstrologyTraditionSelector value={['VEDIC']} onChange={onChange} />);

    const vedicCard = screen.getByText('Vedic / Jyotish').closest('button')!;
    fireEvent.click(vedicCard);

    // Should NOT call onChange (can't have empty)
    expect(onChange).not.toHaveBeenCalled();

    // Should show error message
    expect(screen.getByText('Please select at least one tradition')).toBeDefined();
  });

  it('should disable coming-soon traditions', () => {
    const onChange = vi.fn();
    render(<AstrologyTraditionSelector value={['VEDIC']} onChange={onChange} />);

    const hellenisticCard = screen.getByText('Hellenistic').closest('button')!;
    expect(hellenisticCard.disabled).toBe(true);

    fireEvent.click(hellenisticCard);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('should show "Coming Soon" badge on unavailable traditions', () => {
    const onChange = vi.fn();
    render(<AstrologyTraditionSelector value={['VEDIC']} onChange={onChange} />);

    const badges = screen.getAllByText('Coming Soon');
    expect(badges.length).toBe(3); // HELLENISTIC, HORARY, MEDICAL
  });

  it('should show "Default" badge on Vedic tradition', () => {
    const onChange = vi.fn();
    render(<AstrologyTraditionSelector value={['VEDIC']} onChange={onChange} />);

    expect(screen.getByText('Default')).toBeDefined();
  });
});

// ─── Horoscope Page — Tradition Rendering Tests ─────────────────────────────

describe('Horoscope Page — Tradition Features', () => {
  beforeEach(() => {
    mockFetch.mockReset();
    // Default: resolve any fetch with a valid horoscope
    mockFetch.mockResolvedValue(
      new Response(JSON.stringify({
        prediction: 'Test prediction',
        love: 'Love insights',
        career: 'Career insights',
        health: 'Health insights',
        compatibility: 'Leo',
        mood: 'Positive',
        luckyNumber: 7,
        luckyColor: 'Red',
      }), { status: 200, headers: { 'Content-Type': 'application/json' } })
    );
  });

  it('should render the zodiac sign grid by default', async () => {
    const HoroscopePage = (await import('@/app/horoscope/page')).default;
    render(<HoroscopePage />);

    const signs = ['Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo', 'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces'];
    for (const sign of signs) {
      const els = await screen.findAllByText(sign);
      expect(els.length).toBeGreaterThanOrEqual(1);
    }
  });

  it('should render period tabs', async () => {
    const HoroscopePage = (await import('@/app/horoscope/page')).default;
    render(<HoroscopePage />);

    expect(await screen.findByText('Daily')).toBeDefined();
    expect(screen.getByText('Weekly')).toBeDefined();
    expect(screen.getByText('Monthly')).toBeDefined();
    expect(screen.getByText('Yearly')).toBeDefined();
  });
});

// ─── i18n Traditions Keys Tests ─────────────────────────────────────────────

describe('i18n — traditions section', () => {
  it('should have all required tradition keys in English locale', async () => {
    const { en } = await import('@/i18n/en');

    expect(en.traditions).toBeDefined();
    expect(en.traditions.title).toBe('Astrology Traditions');
    expect(en.traditions.vedic).toBe('Vedic / Jyotish');
    expect(en.traditions.western).toBe('Western Astrology');
    expect(en.traditions.chinese).toBe('Chinese Astrology');
    expect(en.traditions.selectAtLeast).toBe('Please select at least one tradition');
    expect(en.traditions.summary).toBe('Combined Summary');
    expect(en.traditions.comingSoon).toBe('Coming Soon');
    expect(en.traditions.default).toBe('Default');
  });

  it('should have traditions section in Hindi locale', async () => {
    const { hi } = await import('@/i18n/hi');

    expect(hi.traditions).toBeDefined();
    expect(hi.traditions.title).toBeTruthy();
    expect(hi.traditions.vedic).toBeTruthy();
    expect(hi.traditions.western).toBeTruthy();
    expect(hi.traditions.chinese).toBeTruthy();
  });

  it('should have traditions section in Tamil locale', async () => {
    const { ta } = await import('@/i18n/ta');

    expect(ta.traditions).toBeDefined();
    expect(ta.traditions.title).toBeTruthy();
    expect(ta.traditions.vedic).toBeTruthy();
  });

  it('should have traditions section in all other locales', async () => {
    const locales = ['te', 'bn', 'mr', 'gu', 'kn', 'ml', 'pa'];
    for (const loc of locales) {
      const mod = await import(`@/i18n/${loc}`);
      const dict = mod[loc] || mod.default;
      expect(dict.traditions, `${loc} missing traditions section`).toBeDefined();
      expect(dict.traditions.title, `${loc} missing traditions.title`).toBeTruthy();
      expect(dict.traditions.vedic, `${loc} missing traditions.vedic`).toBeTruthy();
      expect(dict.traditions.western, `${loc} missing traditions.western`).toBeTruthy();
      expect(dict.traditions.chinese, `${loc} missing traditions.chinese`).toBeTruthy();
    }
  });

  it('should have all 21 required keys in traditions section', async () => {
    const { en } = await import('@/i18n/en');
    const requiredKeys = [
      'title', 'description', 'vedic', 'vedicDesc', 'western', 'westernDesc',
      'chinese', 'chineseDesc', 'hellenistic', 'hellenisticDesc', 'horary',
      'horaryDesc', 'medical', 'medicalDesc', 'default', 'comingSoon',
      'selectAtLeast', 'next', 'stepBirthDetails', 'stepTraditions', 'summary',
    ];

    for (const key of requiredKeys) {
      expect((en.traditions as any)[key], `en.traditions.${key} missing`).toBeDefined();
      expect(typeof (en.traditions as any)[key]).toBe('string');
    }
  });
});
