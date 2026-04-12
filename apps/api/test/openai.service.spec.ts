import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { OpenAIService } from '../src/openai/openai.service';
import { LlmService } from '../src/llm/llm.service';
import { mockConfigService, mockLlmService } from './helpers/mocks';

describe('OpenAIService', () => {
  let service: OpenAIService;
  let configService: ReturnType<typeof mockConfigService>;

  describe('when no LlmService is available (degraded mode)', () => {
    beforeEach(async () => {
      configService = mockConfigService();

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          OpenAIService,
          { provide: ConfigService, useValue: configService },
        ],
      }).compile();

      service = module.get<OpenAIService>(OpenAIService);
      service.onModuleInit();
    });

    it('should return null when no LlmService available', () => {
      expect(service.getClient()).toBeNull();
    });

    it('should return configured model name', () => {
      expect(service.getModel()).toBe('gpt-4o');
    });

    it('chatCompletion should return null when LlmService is absent', async () => {
      const result = await service.chatCompletion({
        messages: [{ role: 'user', content: 'Hello' }],
      });
      expect(result).toBeNull();
    });
  });

  describe('when LlmService is available', () => {
    let llmService: any;

    beforeEach(async () => {
      configService = mockConfigService({ 'openai.apiKey': 'test-api-key' });
      llmService = mockLlmService();

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          OpenAIService,
          { provide: ConfigService, useValue: configService },
          { provide: LlmService, useValue: llmService },
        ],
      }).compile();

      service = module.get<OpenAIService>(OpenAIService);
      service.onModuleInit();
    });

    it('chatCompletion should delegate to LlmService and return result', async () => {
      const jsonPayload = { sign: 'Aries', prediction: 'A great day ahead' };
      llmService.chatCompletion.mockResolvedValue(jsonPayload);

      const result = await service.chatCompletion({
        messages: [{ role: 'user', content: 'Give me a horoscope' }],
        jsonMode: true,
      });

      expect(result).toEqual(jsonPayload);
      expect(llmService.chatCompletion).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: [{ role: 'user', content: 'Give me a horoscope' }],
          jsonMode: true,
        }),
      );
    });

    it('chatCompletion should propagate LlmService errors', async () => {
      llmService.chatCompletion.mockRejectedValue(new Error('All providers down'));

      await expect(service.chatCompletion({
        messages: [{ role: 'user', content: 'Hello' }],
      })).rejects.toThrow('All providers down');
    });

    it('should expose model from LlmService', () => {
      expect(service.getModel()).toBe('gpt-4o');
    });
  });
});
