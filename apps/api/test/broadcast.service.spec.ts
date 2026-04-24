/**
 * BroadcastService Phase 3 coverage — audience resolution + input
 * validation. The queue itself is mocked; we only care that the
 * service rejects malformed requests and enqueues well-formed ones
 * with the right shape.
 */
import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { getQueueToken } from '@nestjs/bullmq';
import { BroadcastService } from '../src/ops/broadcast.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { BROADCAST_QUEUE } from '../src/queue/queue.constants';

function makePrismaMock() {
  return {
    user: {
      count: jest.fn().mockResolvedValue(0),
      findMany: jest.fn().mockResolvedValue([]),
    },
  };
}

describe('BroadcastService', () => {
  let service: BroadcastService;
  let prisma: ReturnType<typeof makePrismaMock>;
  let queue: { add: jest.Mock };

  beforeEach(async () => {
    prisma = makePrismaMock();
    queue = { add: jest.fn().mockResolvedValue({ id: 'job-1' }) };

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        BroadcastService,
        { provide: PrismaService, useValue: prisma },
        { provide: getQueueToken(BROADCAST_QUEUE), useValue: queue },
      ],
    }).compile();

    service = moduleRef.get<BroadcastService>(BroadcastService);
  });

  describe('audienceCount', () => {
    it('counts all users when audience is "all"', async () => {
      prisma.user.count.mockResolvedValue(123);
      const n = await service.audienceCount({ type: 'all' });
      expect(n).toBe(123);
      expect(prisma.user.count).toHaveBeenCalledWith({ where: {} });
    });

    it('filters by role when audience is "premium"', async () => {
      prisma.user.count.mockResolvedValue(7);
      await service.audienceCount({ type: 'premium' });
      expect(prisma.user.count).toHaveBeenCalledWith({
        where: { role: { in: ['PREMIUM', 'ADMIN'] } },
      });
    });

    it('filters by locale when audience is "locale"', async () => {
      prisma.user.count.mockResolvedValue(42);
      await service.audienceCount({ type: 'locale', locale: 'hi' });
      expect(prisma.user.count).toHaveBeenCalledWith({
        where: { locale: 'hi' },
      });
    });
  });

  describe('enqueue validation', () => {
    const validBase = {
      audience: { type: 'all' as const },
      subject: 'Hello',
      body: 'World',
      channel: 'inapp' as const,
    };

    it('rejects an empty subject', async () => {
      await expect(service.enqueue({ ...validBase, subject: '' }, 'admin@test')).rejects.toThrow(BadRequestException);
    });

    it('rejects an empty body', async () => {
      await expect(service.enqueue({ ...validBase, body: '' }, 'admin@test')).rejects.toThrow(BadRequestException);
    });

    it('rejects a subject that exceeds 200 characters', async () => {
      const longSubject = 'a'.repeat(201);
      await expect(service.enqueue({ ...validBase, subject: longSubject }, 'admin@test')).rejects.toThrow(BadRequestException);
    });

    it('rejects a locale audience with no locale code', async () => {
      await expect(
        service.enqueue({ ...validBase, audience: { type: 'locale', locale: '' } as any }, 'admin@test'),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects an empty audience', async () => {
      prisma.user.count.mockResolvedValue(0);
      await expect(service.enqueue(validBase, 'admin@test')).rejects.toThrow(BadRequestException);
      expect(queue.add).not.toHaveBeenCalled();
    });
  });

  describe('enqueue happy path', () => {
    it('adds a job with the full payload and returns the job id + size', async () => {
      prisma.user.count.mockResolvedValue(50);

      const res = await service.enqueue(
        {
          audience: { type: 'premium' },
          subject: 'Weekly digest',
          body: 'Hello premium users',
          channel: 'inapp',
          notificationType: 'system',
        },
        'admin@example.com',
      );

      expect(res).toEqual({ jobId: 'job-1', audienceSize: 50 });
      expect(queue.add).toHaveBeenCalledTimes(1);
      const [name, payload] = queue.add.mock.calls[0];
      expect(name).toBe('broadcast');
      expect(payload).toMatchObject({
        adminEmail: 'admin@example.com',
        audience: { type: 'premium' },
        subject: 'Weekly digest',
        body: 'Hello premium users',
        channel: 'inapp',
        notificationType: 'system',
      });
    });
  });
});
