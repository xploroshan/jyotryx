import { BadRequestException, NotFoundException } from '@nestjs/common';
import { MemoryService, formatMemoryBlock } from '../src/modules/memory/memory.service';

describe('formatMemoryBlock', () => {
  it('returns an empty string when there are no memories', () => {
    expect(formatMemoryBlock([])).toBe('');
  });

  it('renders each memory as a bullet line under a recall header', () => {
    const block = formatMemoryBlock([
      { kind: 'fact', content: 'Works in IT' },
      { kind: 'goal', content: 'Wants to buy a house in 2026' },
    ]);
    expect(block).toContain('- Works in IT');
    expect(block).toContain('- Wants to buy a house in 2026');
    expect(block).toMatch(/shared with you before/i);
  });
});

describe('MemoryService', () => {
  let service: MemoryService;
  let prisma: any;

  beforeEach(() => {
    prisma = {
      userMemory: {
        findMany: jest.fn(),
        count: jest.fn(),
        create: jest.fn(),
        deleteMany: jest.fn(),
      },
    };
    service = new MemoryService(prisma);
  });

  describe('add', () => {
    it('trims content and falls back to kind "fact" for unknown kinds', async () => {
      prisma.userMemory.count.mockResolvedValue(0);
      prisma.userMemory.create.mockResolvedValue({ id: 'm1' });
      await service.add('u1', { content: '  Works in IT  ', kind: 'bogus' });
      expect(prisma.userMemory.create).toHaveBeenCalledWith({
        data: { userId: 'u1', content: 'Works in IT', kind: 'fact', source: 'user' },
      });
    });

    it('keeps a valid kind', async () => {
      prisma.userMemory.count.mockResolvedValue(0);
      prisma.userMemory.create.mockResolvedValue({ id: 'm1' });
      await service.add('u1', { content: 'Prefers remedies over predictions', kind: 'preference' });
      expect(prisma.userMemory.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ kind: 'preference' }) }),
      );
    });

    it('rejects empty content', async () => {
      await expect(service.add('u1', { content: '   ' })).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.userMemory.create).not.toHaveBeenCalled();
    });

    it('rejects content over the length cap', async () => {
      await expect(service.add('u1', { content: 'x'.repeat(501) })).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects once the per-user cap is reached', async () => {
      prisma.userMemory.count.mockResolvedValue(MemoryService.MAX_MEMORIES);
      await expect(service.add('u1', { content: 'one more' })).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.userMemory.create).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('scopes the delete to the owner', async () => {
      prisma.userMemory.deleteMany.mockResolvedValue({ count: 1 });
      await service.remove('u1', 'm1');
      expect(prisma.userMemory.deleteMany).toHaveBeenCalledWith({ where: { id: 'm1', userId: 'u1' } });
    });

    it('throws NotFound when the row does not belong to the user', async () => {
      prisma.userMemory.deleteMany.mockResolvedValue({ count: 0 });
      await expect(service.remove('u1', 'm1')).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('buildMemoryBlock', () => {
    it('formats the capped, pinned-first memories', async () => {
      prisma.userMemory.findMany.mockResolvedValue([{ kind: 'fact', content: 'Works in IT' }]);
      const block = await service.buildMemoryBlock('u1');
      expect(prisma.userMemory.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId: 'u1' }, take: MemoryService.PROMPT_LIMIT }),
      );
      expect(block).toContain('- Works in IT');
    });

    it('returns an empty string when there is nothing to recall', async () => {
      prisma.userMemory.findMany.mockResolvedValue([]);
      expect(await service.buildMemoryBlock('u1')).toBe('');
    });
  });
});
