import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export interface NotificationPayload {
  userId: string;
  title: string;
  body: string;
  type: 'horoscope' | 'panchang' | 'reminder' | 'promotion' | 'system';
  data?: Record<string, any>;
}

export interface UserNotification {
  id: string;
  userId: string;
  title: string;
  body: string;
  type: string;
  read: boolean;
  createdAt: string;
}

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(private prisma: PrismaService) {}

  async sendPushNotification(payload: NotificationPayload): Promise<boolean> {
    try {
      await this.prisma.notification.create({
        data: {
          userId: payload.userId,
          title: payload.title,
          body: payload.body,
          type: payload.type,
          data: payload.data ?? undefined,
        },
      });
      this.logger.log(`Notification created for user ${payload.userId}: ${payload.title}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to create notification for user ${payload.userId}`, error);
      return false;
    }
  }

  async sendBulkNotification(
    userIds: string[],
    payload: Omit<NotificationPayload, 'userId'>,
  ): Promise<{ sent: number; failed: number }> {
    let sent = 0;
    let failed = 0;

    const data = userIds.map((userId) => ({
      userId,
      title: payload.title,
      body: payload.body,
      type: payload.type,
      data: payload.data ?? undefined,
    }));

    try {
      const result = await this.prisma.notification.createMany({ data });
      sent = result.count;
      failed = userIds.length - sent;
    } catch (error) {
      this.logger.error('Bulk notification failed', error);
      failed = userIds.length;
    }

    return { sent, failed };
  }

  async getUserNotifications(userId: string): Promise<UserNotification[]> {
    const notifications = await this.prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    return notifications.map((n: any) => ({
      id: n.id,
      userId: n.userId,
      title: n.title,
      body: n.body,
      type: n.type,
      read: n.read,
      createdAt: n.createdAt.toISOString(),
    }));
  }

  async markAsRead(userId: string, notificationId: string): Promise<boolean> {
    const result = await this.prisma.notification.updateMany({
      where: { id: notificationId, userId },
      data: { read: true },
    });
    return result.count > 0;
  }

  async markAllAsRead(userId: string): Promise<number> {
    const result = await this.prisma.notification.updateMany({
      where: { userId, read: false },
      data: { read: true },
    });
    return result.count;
  }
}
