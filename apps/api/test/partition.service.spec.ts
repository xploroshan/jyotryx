/**
 * PartitionService Tests
 *
 * Verifies automated partition creation for time-series tables.
 */
import { Test, TestingModule } from '@nestjs/testing';
import { PartitionService } from '../src/partition/partition.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { mockPrismaService } from './helpers/mocks';

describe('PartitionService', () => {
  let service: PartitionService;
  let prisma: ReturnType<typeof mockPrismaService>;

  beforeEach(async () => {
    prisma = mockPrismaService();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PartitionService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<PartitionService>(PartitionService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createNextMonthPartitions', () => {
    it('should create partitions for all 4 tables', async () => {
      await service.createNextMonthPartitions();

      // Should call $executeRawUnsafe once per table
      expect(prisma.$executeRawUnsafe).toHaveBeenCalledTimes(4);
    });

    it('should generate correct partition names with year and month', async () => {
      await service.createNextMonthPartitions();

      const calls = prisma.$executeRawUnsafe.mock.calls.map((c: any[]) => c[0]);
      const next = new Date();
      next.setMonth(next.getMonth() + 1);
      const year = next.getFullYear();
      const month = String(next.getMonth() + 1).padStart(2, '0');

      const tables = ['llm_usage', 'activity_logs', 'chat_messages', 'notifications'];
      for (const table of tables) {
        const expectedName = `${table}_y${year}m${month}`;
        const matchingSql = calls.find((sql: string) => sql.includes(expectedName));
        expect(matchingSql).toBeDefined();
      }
    });

    it('should use CREATE TABLE IF NOT EXISTS syntax', async () => {
      await service.createNextMonthPartitions();

      const calls = prisma.$executeRawUnsafe.mock.calls.map((c: any[]) => c[0]);
      for (const sql of calls) {
        expect(sql).toContain('CREATE TABLE IF NOT EXISTS');
        expect(sql).toContain('PARTITION OF');
        expect(sql).toContain('FOR VALUES FROM');
      }
    });

    it('should span FROM and TO as exactly one calendar month', async () => {
      await service.createNextMonthPartitions();

      const sql = prisma.$executeRawUnsafe.mock.calls[0][0] as string;
      const fromMatch = sql.match(/FROM \('(\d{4}-\d{2}-01)'\)/);
      const toMatch = sql.match(/TO \('(\d{4}-\d{2}-01)'\)/);

      expect(fromMatch).toBeTruthy();
      expect(toMatch).toBeTruthy();

      const fromDate = new Date(fromMatch![1]);
      const toDate = new Date(toMatch![1]);
      // TO should be exactly 1 month after FROM
      const expectedTo = new Date(fromDate);
      expectedTo.setMonth(expectedTo.getMonth() + 1);
      expect(toDate.getTime()).toBe(expectedTo.getTime());
    });

    it('should handle "already exists" error gracefully', async () => {
      prisma.$executeRawUnsafe
        .mockRejectedValueOnce(new Error('relation "llm_usage_y2026m05" already exists'))
        .mockResolvedValue(0); // subsequent calls succeed

      // Should not throw
      await expect(service.createNextMonthPartitions()).resolves.toBeUndefined();
      // Should still attempt remaining tables
      expect(prisma.$executeRawUnsafe).toHaveBeenCalledTimes(4);
    });

    it('should handle overlap error gracefully', async () => {
      prisma.$executeRawUnsafe
        .mockRejectedValueOnce(new Error('partition "llm_usage_y2026m05" would overlap'))
        .mockResolvedValue(0);

      await expect(service.createNextMonthPartitions()).resolves.toBeUndefined();
    });

    it('should log unexpected errors but continue processing', async () => {
      prisma.$executeRawUnsafe
        .mockRejectedValueOnce(new Error('connection refused'))
        .mockResolvedValue(0);

      await expect(service.createNextMonthPartitions()).resolves.toBeUndefined();
      // Still processes remaining 3 tables
      expect(prisma.$executeRawUnsafe).toHaveBeenCalledTimes(4);
    });
  });
});
