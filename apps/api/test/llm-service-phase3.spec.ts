/**
 * Phase 3 LlmService coverage:
 *
 *  1. `computeCost` honours per-model cost overrides loaded from
 *     `site_settings.pricing.llm.*`. Either half of the rate can be
 *     overridden independently.
 *  2. `isProviderEnabled` respects both key shapes
 *     (`llm.provider.{name}.enabled` and the legacy `llm.{name}.enabled`).
 *  3. `reloadConfig` wires the settings into `currentConfig` so the
 *     provider chain in `chatCompletion` can skip disabled providers.
 *
 * We mock Prisma so no real DB is involved; these tests verify the
 * pure config-loading + cost-math paths.
 */
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { LlmService } from '../src/llm/llm.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { OpenAIProvider } from '../src/llm/providers/openai.provider';
import { AnthropicProvider } from '../src/llm/providers/anthropic.provider';
import { GeminiProvider } from '../src/llm/providers/gemini.provider';

function mockConfigService() {
  const config: Record<string, any> = {
    'llm.failoverEnabled': 'true',
    'openai.apiKey': 'seed-key',
    'openai.model': 'gpt-4o-mini',
    'openai.modelPrecision': 'gpt-4o',
    'openai.modelVision': 'gpt-4o-mini',
  };
  return {
    get: jest.fn((key: string, fallback?: any) => config[key] ?? fallback),
  };
}

function mockProvider() {
  return {
    isAvailable: jest.fn().mockReturnValue(true),
    reinitialize: jest.fn(),
    chatCompletion: jest.fn(),
    chatCompletionStream: jest.fn(),
  };
}

describe('LlmService Phase 3 — cost overrides + kill-switch', () => {
  let service: LlmService;
  let prisma: { siteSetting: { findMany: jest.Mock } };

  beforeEach(async () => {
    prisma = { siteSetting: { findMany: jest.fn().mockResolvedValue([]) } };

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        LlmService,
        { provide: ConfigService, useValue: mockConfigService() },
        { provide: OpenAIProvider, useValue: mockProvider() },
        { provide: AnthropicProvider, useValue: mockProvider() },
        { provide: GeminiProvider, useValue: mockProvider() },
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = moduleRef.get<LlmService>(LlmService);
  });

  describe('computeCost', () => {
    it('falls back to the static table when no override is configured', () => {
      // gpt-4o-mini static rate: prompt 0.15 / completion 0.6 per 1M.
      // 1000 prompt + 1000 completion = (0.15 + 0.6) / 1000 = 0.00075
      expect(service.computeCost('gpt-4o-mini', 1000, 1000)).toBeCloseTo(0.00075, 6);
    });

    it('uses an override when site_settings declares one', async () => {
      prisma.siteSetting.findMany.mockResolvedValue([
        // Override both halves: prompt 1.0, completion 4.0 per 1M.
        { key: 'pricing.llm.gpt-4o-mini.prompt', value: '1.0' },
        { key: 'pricing.llm.gpt-4o-mini.completion', value: '4.0' },
      ]);
      await service.invalidateCache();

      // 1000 prompt + 1000 completion = (1 + 4) / 1000 = 0.005
      expect(service.computeCost('gpt-4o-mini', 1000, 1000)).toBeCloseTo(0.005, 6);
    });

    it('allows partial overrides — only completion half', async () => {
      prisma.siteSetting.findMany.mockResolvedValue([
        { key: 'pricing.llm.gpt-4o-mini.completion', value: '2.0' },
      ]);
      await service.invalidateCache();

      // prompt stays at static 0.15, completion is now 2.0.
      // 1000 * 0.15 + 1000 * 2.0 = 2150, / 1M = 0.00215
      expect(service.computeCost('gpt-4o-mini', 1000, 1000)).toBeCloseTo(0.00215, 6);
    });

    it('ignores non-numeric or negative override values defensively', async () => {
      prisma.siteSetting.findMany.mockResolvedValue([
        { key: 'pricing.llm.gpt-4o-mini.prompt', value: 'NaN' },
        { key: 'pricing.llm.gpt-4o-mini.completion', value: '-5' },
      ]);
      await service.invalidateCache();
      // Both malformed overrides discarded → base rates.
      expect(service.computeCost('gpt-4o-mini', 1000, 1000)).toBeCloseTo(0.00075, 6);
    });
  });

  describe('isProviderEnabled kill-switch', () => {
    it('defaults to enabled when no setting is present', async () => {
      await service.invalidateCache();
      expect(service.isProviderEnabled('openai')).toBe(true);
      expect(service.isProviderEnabled('gemini')).toBe(true);
      expect(service.isProviderEnabled('anthropic')).toBe(true);
    });

    it('reads the canonical Phase 3 key shape', async () => {
      prisma.siteSetting.findMany.mockResolvedValue([
        { key: 'llm.provider.openai.enabled', value: 'false' },
      ]);
      await service.invalidateCache();
      expect(service.isProviderEnabled('openai')).toBe(false);
      // Other providers unaffected.
      expect(service.isProviderEnabled('gemini')).toBe(true);
    });

    it('honours the legacy LlmTab key shape', async () => {
      prisma.siteSetting.findMany.mockResolvedValue([
        { key: 'llm.gemini.enabled', value: 'false' },
      ]);
      await service.invalidateCache();
      expect(service.isProviderEnabled('gemini')).toBe(false);
    });

    it('canonical key wins over legacy when both are set', async () => {
      prisma.siteSetting.findMany.mockResolvedValue([
        { key: 'llm.anthropic.enabled', value: 'true' },           // legacy says on
        { key: 'llm.provider.anthropic.enabled', value: 'false' }, // canonical says off
      ]);
      await service.invalidateCache();
      expect(service.isProviderEnabled('anthropic')).toBe(false);
    });
  });
});
