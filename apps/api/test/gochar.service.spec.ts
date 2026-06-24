import { Test, TestingModule } from '@nestjs/testing';
import { GocharService } from '../src/modules/daily-briefing/gochar.service';
import { EphemerisService } from '../src/ephemeris/ephemeris.service';

// Build a ChartResult-like object from a map of planet -> sidereal longitude.
function chart(longitudes: Record<string, number>) {
  const positions = Object.entries(longitudes).map(([name, longitude]) => ({ name, longitude, speed: 0 }));
  return { julianDay: 0, positions, ascendant: 0, houses: [] as number[] };
}

const PLACE = { lat: 19.076, lng: 72.8777, name: 'Mumbai' };

describe('GocharService', () => {
  let service: GocharService;
  let ephemeris: { computeChart: jest.Mock; computeCurrentChart: jest.Mock };

  beforeEach(async () => {
    ephemeris = {
      computeChart: jest.fn(),
      computeCurrentChart: jest.fn(),
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [GocharService, { provide: EphemerisService, useValue: ephemeris }],
    }).compile();
    service = module.get(GocharService);
  });

  it('returns null when the user has no birth date or time', async () => {
    expect(await service.computePersonalization({ dateOfBirth: null, timeOfBirth: '10:30', placeOfBirth: PLACE }, new Date())).toBeNull();
    expect(await service.computePersonalization({ dateOfBirth: new Date(), timeOfBirth: null, placeOfBirth: PLACE }, new Date())).toBeNull();
  });

  it('returns null when the place is not geocoded', async () => {
    const r = await service.computePersonalization(
      { dateOfBirth: new Date('1990-05-15'), timeOfBirth: '10:30', placeOfBirth: { name: 'Mumbai', lat: 0, lng: 0 } },
      new Date(),
    );
    expect(r).toBeNull();
  });

  it('derives the natal Moon sign from the ephemeris', async () => {
    // Natal Moon at 100° -> Cancer (90-120, idx 3).
    ephemeris.computeChart.mockResolvedValue(chart({ Moon: 100, Sun: 50 }));
    ephemeris.computeCurrentChart.mockResolvedValue(chart({ Moon: 200, Saturn: 300, Jupiter: 60 }));

    const r = await service.computePersonalization(
      { dateOfBirth: new Date('1990-05-15'), timeOfBirth: '10:30', placeOfBirth: PLACE },
      new Date(),
    );
    expect(r).not.toBeNull();
    expect(r!.moonSign).toBe('Cancer');
    expect(r!.luckyColor).toBe('Pearl White'); // Moon-ruled Cancer
    expect(['excellent', 'good', 'moderate', 'challenging']).toContain(r!.dayQuality);
  });

  it('produces different readings for users with different natal Moons', async () => {
    const transit = chart({ Moon: 200, Saturn: 300, Jupiter: 60 });

    ephemeris.computeChart.mockResolvedValueOnce(chart({ Moon: 10, Sun: 50 })); // Aries Moon
    ephemeris.computeCurrentChart.mockResolvedValueOnce(transit);
    const a = await service.computePersonalization(
      { dateOfBirth: new Date('1990-01-03'), timeOfBirth: '10:30', placeOfBirth: PLACE },
      new Date(),
    );

    ephemeris.computeChart.mockResolvedValueOnce(chart({ Moon: 250, Sun: 50 })); // Sagittarius Moon
    ephemeris.computeCurrentChart.mockResolvedValueOnce(transit);
    const b = await service.computePersonalization(
      { dateOfBirth: new Date('1992-07-22'), timeOfBirth: '10:30', placeOfBirth: PLACE },
      new Date(),
    );

    expect(a!.moonSign).not.toBe(b!.moonSign);
    // Lucky number follows the birth day-of-month, so it differs too.
    expect(a!.luckyNumber).not.toBe(b!.luckyNumber);
  });

  it('flags Sade Sati when transit Saturn sits on the natal Moon sign', async () => {
    // Natal Moon 100° (Cancer, idx 3); Saturn transit 100° (also Cancer) -> peak.
    ephemeris.computeChart.mockResolvedValue(chart({ Moon: 100, Sun: 50 }));
    ephemeris.computeCurrentChart.mockResolvedValue(chart({ Moon: 200, Saturn: 100, Jupiter: 60 }));

    const r = await service.computePersonalization(
      { dateOfBirth: new Date('1990-05-15'), timeOfBirth: '10:30', placeOfBirth: PLACE },
      new Date(),
    );
    expect(r!.transitAlert).toContain('Sade Sati');
  });

  it('returns null (not throw) when the ephemeris fails', async () => {
    ephemeris.computeChart.mockRejectedValue(new Error('swisseph down'));
    const r = await service.computePersonalization(
      { dateOfBirth: new Date('1990-05-15'), timeOfBirth: '10:30', placeOfBirth: PLACE },
      new Date(),
    );
    expect(r).toBeNull();
  });

  describe('computeEphemerisPanchang', () => {
    it('derives tithi/nakshatra/yoga from real Sun/Moon longitudes', async () => {
      ephemeris.computeCurrentChart.mockResolvedValue(chart({ Sun: 30, Moon: 100 }));
      const p = await service.computeEphemerisPanchang(new Date('2026-06-10'));
      expect(p.tithiKey).toBeTruthy();
      expect(p.nakshatraKey).toBeTruthy();
      expect(p.yogaKey).toBeTruthy();
      expect(p.pakshaKey).toMatch(/^(Shukla|Krishna)$/);
      expect(p.varaKey).toBeTruthy();
      expect(p.rahukaal).toBeTruthy();
    });
  });
});
