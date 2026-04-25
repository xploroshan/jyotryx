/**
 * Phase 4 GDPR workflow — creation, listing, fulfillment. The important
 * invariants we pin here:
 *   1. `fulfill` for a "delete" request calls GdprPurgeService AND
 *      removes the user row. An already-missing user row (race with
 *      another admin) is swallowed idempotently.
 *   2. `fulfill` for an "export" request returns a payload but does
 *      NOT touch the purge service.
 *   3. `reject` requires a non-empty note.
 *   4. `create` is idempotent for the same (user, type) while pending.
 */
import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { GdprRequestService } from '../src/gdpr/gdpr-request.service';
import { GdprPurgeService } from '../src/modules/admin/gdpr-purge.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { PrismaReadReplicaService } from '../src/prisma/prisma-read-replica.service';

function makePrisma() {
  return {
    user: {
      findUnique: jest.fn(),
      delete: jest.fn().mockResolvedValue({}),
      findMany: jest.fn().mockResolvedValue([]),
    },
    gdprRequest: {
      findFirst: jest.fn().mockResolvedValue(null),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  };
}

describe('GdprRequestService', () => {
  let service: GdprRequestService;
  let prisma: ReturnType<typeof makePrisma>;
  let purge: { purgeUserData: jest.Mock };

  beforeEach(async () => {
    prisma = makePrisma();
    purge = { purgeUserData: jest.fn().mockResolvedValue(undefined) };

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        GdprRequestService,
        { provide: PrismaService, useValue: prisma },
        { provide: PrismaReadReplicaService, useValue: prisma },
        { provide: GdprPurgeService, useValue: purge },
      ],
    }).compile();
    service = moduleRef.get<GdprRequestService>(GdprRequestService);
  });

  describe('create', () => {
    it('creates a request with a 30-day SLA', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'u-1', email: 'a@b.com', name: 'Alice' });
      const now = Date.now();
      prisma.gdprRequest.create.mockImplementation(async ({ data }: any) => ({
        id: 'req-1',
        userId: data.userId,
        type: data.type,
        status: 'pending',
        dueBy: data.dueBy,
        fulfilledAt: null,
        adminId: null,
        note: data.note ?? null,
        createdAt: new Date(),
      }));

      const row = await service.create({ userId: 'u-1', type: 'export' });

      const sla = new Date(row.dueBy).getTime();
      // 30 days ±2s tolerance for test runtime jitter.
      expect(sla - now).toBeGreaterThanOrEqual(30 * 86400 * 1000 - 2000);
      expect(sla - now).toBeLessThanOrEqual(30 * 86400 * 1000 + 2000);
      expect(row.type).toBe('export');
      expect(row.status).toBe('pending');
    });

    it('is idempotent when a pending request already exists', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'u-1', email: 'a@b.com', name: 'A' });
      prisma.gdprRequest.findFirst.mockResolvedValue({
        id: 'existing-req',
        userId: 'u-1',
        type: 'delete',
        status: 'pending',
        dueBy: new Date(Date.now() + 10 * 86400_000),
        fulfilledAt: null,
        adminId: null,
        note: null,
        createdAt: new Date(),
      });

      const row = await service.create({ userId: 'u-1', type: 'delete' });

      expect(row.id).toBe('existing-req');
      expect(prisma.gdprRequest.create).not.toHaveBeenCalled();
    });

    it('rejects unsupported types', async () => {
      await expect(
        service.create({ userId: 'u-1', type: 'leak' as any }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects a missing user', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(
        service.create({ userId: 'missing', type: 'export' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('fulfill', () => {
    beforeEach(() => {
      prisma.gdprRequest.findUnique.mockResolvedValue({
        id: 'req-1',
        userId: 'u-1',
        type: 'delete',
        status: 'pending',
        dueBy: new Date(Date.now() + 10 * 86400_000),
        fulfilledAt: null,
        adminId: null,
        note: null,
        createdAt: new Date(),
      });
      prisma.gdprRequest.update.mockImplementation(async ({ data }: any) => ({
        id: 'req-1',
        userId: 'u-1',
        type: 'delete',
        status: data.status,
        dueBy: new Date(Date.now() + 10 * 86400_000),
        fulfilledAt: data.fulfilledAt,
        adminId: data.adminId,
        note: data.note,
        createdAt: new Date(),
      }));
      prisma.user.findUnique.mockResolvedValue({ id: 'u-1', email: 'a@b.com', name: 'A' });
    });

    it('delete → calls purge + deletes user row', async () => {
      const result = await service.fulfill('req-1', 'admin-1');
      expect(purge.purgeUserData).toHaveBeenCalledWith('u-1');
      expect(prisma.user.delete).toHaveBeenCalledWith({ where: { id: 'u-1' } });
      expect(result.row.status).toBe('fulfilled');
      expect(result.exportPayload).toBeUndefined();
    });

    it('idempotent delete — swallows P2025 when user row already gone', async () => {
      const err: any = new Error('not found');
      err.code = 'P2025';
      prisma.user.delete.mockRejectedValue(err);
      await expect(service.fulfill('req-1', 'admin-1')).resolves.toMatchObject({
        row: { status: 'fulfilled' },
      });
    });

    it('export → builds payload, never calls purge', async () => {
      prisma.gdprRequest.findUnique.mockResolvedValue({
        id: 'req-2',
        userId: 'u-1',
        type: 'export',
        status: 'pending',
        dueBy: new Date(Date.now() + 10 * 86400_000),
        fulfilledAt: null,
        adminId: null,
        note: null,
        createdAt: new Date(),
      });
      prisma.user.findUnique.mockResolvedValue({
        id: 'u-1',
        email: 'a@b.com',
        name: 'A',
        phone: null,
        createdAt: new Date(),
        role: 'USER',
        locale: 'en',
        subscriptions: [],
        payments: [],
        chatSessions: [],
        kundliCharts: [],
        reports: [],
        creditTransactions: [],
        tarotReadings: [],
        matchingResults: [],
        palmistryReadings: [],
      });

      const result = await service.fulfill('req-2', 'admin-1');
      expect(purge.purgeUserData).not.toHaveBeenCalled();
      expect(prisma.user.delete).not.toHaveBeenCalled();
      expect(result.exportPayload).toBeDefined();
      expect(result.exportPayload?.userId).toBe('u-1');
    });

    it('refuses to fulfill a non-pending request', async () => {
      prisma.gdprRequest.findUnique.mockResolvedValue({
        id: 'req-3',
        userId: 'u-1',
        type: 'export',
        status: 'fulfilled',
        dueBy: new Date(),
        fulfilledAt: new Date(),
        adminId: 'admin-1',
        note: null,
        createdAt: new Date(),
      });
      await expect(service.fulfill('req-3', 'admin-1')).rejects.toThrow(BadRequestException);
    });
  });

  describe('reject', () => {
    it('requires a note', async () => {
      prisma.gdprRequest.findUnique.mockResolvedValue({ id: 'r', userId: 'u', type: 'export', status: 'pending', dueBy: new Date(), createdAt: new Date() });
      await expect(service.reject('r', 'admin-1', '   ')).rejects.toThrow(BadRequestException);
    });
  });
});
