import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { PushService } from '../src/modules/user/push.service';
import { PrismaService } from '../src/prisma/prisma.service';

// firebase-admin (14, modular API) is mocked module-wide; the apps list is
// mutated per test to flip between initialized and mock mode.
const sendEachForMulticast = jest.fn();
const firebaseAppsList: unknown[] = [];
jest.mock('firebase-admin/app', () => ({
  getApps: () => firebaseAppsList,
  initializeApp: jest.fn(),
  cert: jest.fn(),
}));
jest.mock('firebase-admin/messaging', () => ({
  getMessaging: () => ({ sendEachForMulticast }),
}));

describe('PushService', () => {
  let service: PushService;
  let prisma: any;

  const USER_ID = 'user-1';

  beforeEach(async () => {
    jest.clearAllMocks();
    firebaseAppsList.length = 0;
    firebaseAppsList.push({}); // default: initialized

    prisma = {
      pushToken: {
        upsert: jest.fn().mockResolvedValue({}),
        deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
        findMany: jest.fn().mockResolvedValue([]),
      },
      briefingDelivery: {
        create: jest.fn().mockResolvedValue({}),
      },
      siteSetting: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PushService,
        { provide: PrismaService, useValue: prisma },
        { provide: ConfigService, useValue: { get: jest.fn(() => undefined) } },
      ],
    }).compile();

    service = module.get<PushService>(PushService);
  });

  // ── registry ─────────────────────────────────────────────────────────

  it('registers a token via upsert (reassigns to the current user)', async () => {
    const res = await service.registerToken(USER_ID, 'tok-1', 'android');
    expect(res).toEqual({ registered: true });
    expect(prisma.pushToken.upsert).toHaveBeenCalledWith({
      where: { token: 'tok-1' },
      create: { userId: USER_ID, token: 'tok-1', platform: 'android' },
      update: { userId: USER_ID, platform: 'android' },
    });
  });

  it('unregisters only the owner’s token', async () => {
    await service.unregisterToken(USER_ID, 'tok-1');
    expect(prisma.pushToken.deleteMany).toHaveBeenCalledWith({
      where: { token: 'tok-1', userId: USER_ID },
    });
  });

  // ── delivery ─────────────────────────────────────────────────────────

  it('sends to every device and prunes dead tokens', async () => {
    prisma.pushToken.findMany.mockResolvedValue([{ token: 'live' }, { token: 'dead' }]);
    sendEachForMulticast.mockResolvedValue({
      successCount: 1,
      responses: [
        { success: true },
        { success: false, error: { code: 'messaging/registration-token-not-registered' } },
      ],
    });

    const res = await service.sendToUser(USER_ID, { title: 'T', body: 'B', url: '/my-day' });

    expect(res.sent).toBe(1);
    expect(sendEachForMulticast).toHaveBeenCalledWith(
      expect.objectContaining({
        tokens: ['live', 'dead'],
        data: { url: '/my-day' },
      }),
    );
    expect(prisma.pushToken.deleteMany).toHaveBeenCalledWith({
      where: { token: { in: ['dead'] } },
    });
  });

  it('is a no-op in mock mode (Firebase not initialized)', async () => {
    firebaseAppsList.length = 0;
    const res = await service.sendToUser(USER_ID, { title: 'T', body: 'B' });
    expect(res.sent).toBe(0);
    expect(prisma.pushToken.findMany).not.toHaveBeenCalled();
  });

  // ── daily-briefing push ──────────────────────────────────────────────

  const NINE_UTC = new Date('2026-07-02T09:00:00Z');

  it('does nothing when the feature flag is off', async () => {
    prisma.siteSetting.findMany.mockResolvedValue([]);
    const res = await service.runDailyBriefingPush(NINE_UTC);
    expect(res).toEqual({ sent: 0, skipped: 0 });
    expect(prisma.pushToken.findMany).not.toHaveBeenCalled();
  });

  it('does nothing outside the configured send hour', async () => {
    prisma.siteSetting.findMany.mockResolvedValue([
      { key: 'notification.briefing.push_enabled', value: 'true' },
      { key: 'notification.briefing.push_hour_utc', value: '3' },
    ]);
    const res = await service.runDailyBriefingPush(NINE_UTC);
    expect(res).toEqual({ sent: 0, skipped: 0 });
  });

  it('sends once per user per day (P2002 dedup) on the configured hour', async () => {
    prisma.siteSetting.findMany.mockResolvedValue([
      { key: 'notification.briefing.push_enabled', value: 'true' },
      { key: 'notification.briefing.push_hour_utc', value: '9' },
    ]);
    // Two users with devices; the second already got today's push.
    prisma.pushToken.findMany
      .mockResolvedValueOnce([{ userId: 'u1' }, { userId: 'u2' }]) // distinct users
      .mockResolvedValue([{ token: 't1' }]); // sendToUser lookup
    prisma.briefingDelivery.create
      .mockResolvedValueOnce({})
      .mockRejectedValueOnce({ code: 'P2002' });
    sendEachForMulticast.mockResolvedValue({ successCount: 1, responses: [{ success: true }] });

    const res = await service.runDailyBriefingPush(NINE_UTC);

    expect(res).toEqual({ sent: 1, skipped: 1 });
    expect(prisma.briefingDelivery.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ userId: 'u1', channel: 'push', status: 'SENT' }),
    });
    expect(sendEachForMulticast).toHaveBeenCalledTimes(1);
  });
});
