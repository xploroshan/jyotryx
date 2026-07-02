import { pathFromNotificationData } from './push';

describe('pathFromNotificationData', () => {
  it('routes to the path in data.url', () => {
    expect(pathFromNotificationData({ url: '/my-day' })).toBe('/my-day');
    expect(pathFromNotificationData({ url: '/feature/horoscope' })).toBe('/feature/horoscope');
  });

  it('falls back to the tabs for missing/invalid urls', () => {
    expect(pathFromNotificationData(undefined)).toBe('/(tabs)');
    expect(pathFromNotificationData({})).toBe('/(tabs)');
    expect(pathFromNotificationData({ url: 'https://evil.example.com' })).toBe('/(tabs)');
    expect(pathFromNotificationData({ url: 42 })).toBe('/(tabs)');
  });
});
