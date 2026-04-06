import { Test, TestingModule } from '@nestjs/testing';
import { NotificationService } from '../src/modules/notification/notification.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { mockPrismaService } from './helpers/mocks';

describe('NotificationService – CRUD', () => {
  let service: NotificationService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      ...mockPrismaService(),
      notification: {
        create: jest.fn().mockResolvedValue({
          id: 'notif-1',
          userId: 'test-uuid',
          title: 'Test',
          body: 'Test body',
          type: 'system',
          read: false,
          createdAt: new Date(),
        }),
        createMany: jest.fn().mockResolvedValue({ count: 3 }),
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'notif-1',
            userId: 'test-uuid',
            title: 'Test',
            body: 'Test body',
            type: 'system',
            read: false,
            createdAt: new Date('2026-01-01'),
          },
          {
            id: 'notif-2',
            userId: 'test-uuid',
            title: 'Test 2',
            body: 'Test body 2',
            type: 'horoscope',
            read: true,
            createdAt: new Date('2025-12-31'),
          },
        ]),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<NotificationService>(NotificationService);
  });

  it('should create a notification via sendPushNotification', async () => {
    const result = await service.sendPushNotification({
      userId: 'test-uuid',
      title: 'Daily Horoscope',
      body: 'Your horoscope is ready',
      type: 'horoscope',
    });

    expect(result).toBe(true);
    expect(prisma.notification.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'test-uuid',
        title: 'Daily Horoscope',
        body: 'Your horoscope is ready',
        type: 'horoscope',
      }),
    });
  });

  it('should return user notifications ordered by createdAt desc', async () => {
    const result = await service.getUserNotifications('test-uuid');

    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(2);
    expect(prisma.notification.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 'test-uuid' },
        orderBy: { createdAt: 'desc' },
      }),
    );
    // Verify mapping
    expect(result[0]).toHaveProperty('id');
    expect(result[0]).toHaveProperty('createdAt');
    expect(typeof result[0].createdAt).toBe('string');
  });

  it('should mark a notification as read', async () => {
    const result = await service.markAsRead('test-uuid', 'notif-1');

    expect(result).toBe(true);
    expect(prisma.notification.updateMany).toHaveBeenCalledWith({
      where: { id: 'notif-1', userId: 'test-uuid' },
      data: { read: true },
    });
  });

  it('should mark all as read', async () => {
    const result = await service.markAllAsRead('test-uuid');

    expect(result).toBe(1);
    expect(prisma.notification.updateMany).toHaveBeenCalledWith({
      where: { userId: 'test-uuid', read: false },
      data: { read: true },
    });
  });

  it('should send bulk notifications', async () => {
    const userIds = ['user-1', 'user-2', 'user-3'];
    const result = await service.sendBulkNotification(userIds, {
      title: 'Panchang Update',
      body: 'Today is an auspicious day',
      type: 'panchang',
    });

    expect(result.sent).toBe(3);
    expect(result.failed).toBe(0);
    expect(prisma.notification.createMany).toHaveBeenCalledWith({
      data: expect.arrayContaining([
        expect.objectContaining({ userId: 'user-1', title: 'Panchang Update' }),
        expect.objectContaining({ userId: 'user-2' }),
        expect.objectContaining({ userId: 'user-3' }),
      ]),
    });
  });
});
