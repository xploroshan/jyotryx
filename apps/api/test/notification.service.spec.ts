import { Test, TestingModule } from '@nestjs/testing';
import { NotificationService, NotificationPayload, UserNotification } from '../src/modules/notification/notification.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { mockPrismaService } from './helpers/mocks';

describe('NotificationService', () => {
  let service: NotificationService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationService,
        { provide: PrismaService, useValue: mockPrismaService() },
      ],
    }).compile();

    service = module.get<NotificationService>(NotificationService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('sendPushNotification', () => {
    it('should return true', async () => {
      const payload: NotificationPayload = {
        userId: 'test-uuid',
        title: 'Daily Horoscope',
        body: 'Your horoscope is ready!',
        type: 'horoscope',
      };

      const result = await service.sendPushNotification(payload);
      expect(result).toBe(true);
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
    });
  });

  describe('getUserNotifications', () => {
    it('should return array of notifications', async () => {
      const notifications = await service.getUserNotifications('test-uuid');
      expect(Array.isArray(notifications)).toBe(true);
      expect(notifications.length).toBeGreaterThan(0);
    });

    it('each notification should have required fields', async () => {
      const notifications = await service.getUserNotifications('test-uuid');
      const requiredFields: (keyof UserNotification)[] = [
        'id',
        'title',
        'body',
        'type',
        'read',
        'createdAt',
      ];

      for (const notification of notifications) {
        for (const field of requiredFields) {
          expect(notification).toHaveProperty(field);
        }
      }
    });
  });

  describe('markAsRead', () => {
    it('should return true', async () => {
      const result = await service.markAsRead('test-uuid', '1');
      expect(result).toBe(true);
    });
  });
});
