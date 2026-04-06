import { Test, TestingModule } from '@nestjs/testing';
import { NotificationService, NotificationPayload, UserNotification } from '../src/modules/notification/notification.service';
import { PrismaService } from '../src/prisma/prisma.service';

describe('NotificationService', () => {
  let service: NotificationService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      notification: {
        create: jest.fn().mockResolvedValue({ id: 'notif-1', userId: 'test-uuid', title: 'Test', body: 'Body', type: 'general', read: false, createdAt: new Date() }),
        createMany: jest.fn().mockResolvedValue({ count: 3 }),
        findMany: jest.fn().mockResolvedValue([
          { id: 'notif-1', userId: 'test-uuid', title: 'Daily Horoscope', body: 'Ready!', type: 'horoscope', read: false, createdAt: new Date() },
          { id: 'notif-2', userId: 'test-uuid', title: 'Reminder', body: 'Check panchang', type: 'reminder', read: true, createdAt: new Date(Date.now() - 86400000) },
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

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('sendPushNotification', () => {
    it('should create a notification and return true', async () => {
      const payload: NotificationPayload = {
        userId: 'test-uuid',
        title: 'Daily Horoscope',
        body: 'Your horoscope is ready!',
        type: 'horoscope',
      };

      const result = await service.sendPushNotification(payload);
      expect(result).toBe(true);
      expect(prisma.notification.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ userId: 'test-uuid', title: 'Daily Horoscope' }),
        }),
      );
    });
  });

  describe('sendBulkNotification', () => {
    it('should return correct sent count', async () => {
      const userIds = ['user-1', 'user-2', 'user-3'];
      const payload = {
        title: 'System Update',
        body: 'New features available!',
        type: 'system' as const,
      };

      const result = await service.sendBulkNotification(userIds, payload);
      expect(result).toEqual({ sent: 3, failed: 0 });
      expect(prisma.notification.createMany).toHaveBeenCalled();
    });
  });

  describe('getUserNotifications', () => {
    it('should return array of notifications', async () => {
      const notifications = await service.getUserNotifications('test-uuid');
      expect(Array.isArray(notifications)).toBe(true);
      expect(notifications.length).toBe(2);
    });

    it('each notification should have required fields', async () => {
      const notifications = await service.getUserNotifications('test-uuid');
      const requiredFields: (keyof UserNotification)[] = ['id', 'title', 'body', 'type', 'read', 'createdAt'];

      for (const notification of notifications) {
        for (const field of requiredFields) {
          expect(notification).toHaveProperty(field);
        }
      }
    });
  });

  describe('markAsRead', () => {
    it('should return true', async () => {
      const result = await service.markAsRead('test-uuid', 'notif-1');
      expect(result).toBe(true);
      expect(prisma.notification.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'notif-1', userId: 'test-uuid' },
          data: { read: true },
        }),
      );
    });
  });
});
