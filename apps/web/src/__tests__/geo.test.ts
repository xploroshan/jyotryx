import { describe, it, expect } from 'vitest';
import { mapsSearchUrl } from '@/lib/geo';

describe('mapsSearchUrl', () => {
  it('builds a plain query URL when no coords are given', () => {
    const u = mapsSearchUrl('Shiva temple');
    expect(u).toBe('https://www.google.com/maps/search/?api=1&query=Shiva%20temple');
  });

  it('centers the search near the user when coords are provided', () => {
    const u = mapsSearchUrl('Hanuman temple', { lat: 19.07, lng: 72.87 });
    expect(u).toContain('Hanuman%20temple');
    expect(u).toContain('@19.07,72.87,12z');
  });

  it('falls back to a plain query when coords are null', () => {
    const u = mapsSearchUrl('Vishnu temple', null);
    expect(u).toContain('/maps/search/?api=1&query=Vishnu%20temple');
  });
});
