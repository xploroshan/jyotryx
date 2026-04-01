import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { OpenAIService } from '../src/openai/openai.service';
import { mockConfigService } from './helpers/mocks';

describe('OpenAIService', () => {
  let service: OpenAIService;
  let configService: ReturnType<typeof mockConfigService>;

  describe('when no API key is configured', () => {
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

    it('should return null when no API key configured', () => {
      expect(service.getClient()).toBeNull();
    });

    it('should return configured model name', () => {
      expect(service.getModel()).toBe('gpt-4o');
    });

    it('chatCompletion should return null when client is null', async () => {
      const result = await service.chatCompletion({
        messages: [{ role: 'user', content: 'Hello' }],
      });
      expect(result).toBeNull();
    });
  });

  describe('when API key is configured', () => {
    let mockCreate: jest.Mock;

    beforeEach(async () => {
      mockCreate = jest.fn();

      configService = mockConfigService({ 'openai.apiKey': 'test-api-key' });

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          OpenAIService,
          { provide: ConfigService, useValue: configService },
        ],
      }).compile();

      service = module.get<OpenAIService>(OpenAIService);

      // Mock the require('openai') call by setting the client directly
      (service as any).client = {
        chat: {
          completions: {
            create: mockCreate,
          },
        },
      };
    });

    it('chatCompletion should handle JSON mode parsing', async () => {
      const jsonPayload = { sign: 'Aries', prediction: 'A great day ahead' };
      mockCreate.mockResolvedValue({
        choices: [{ message: { content: JSON.stringify(jsonPayload) } }],
      });

      const result = await service.chatCompletion({
        messages: [{ role: 'user', content: 'Give me a horoscope' }],
        jsonMode: true,
      });

      expect(result).toEqual(jsonPayload);
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          response_format: { type: 'json_object' },
        }),
      );
    });

    it('chatCompletion should return null on API error', async () => {
      mockCreate.mockRejectedValue(new Error('API rate limit exceeded'));

      const result = await service.chatCompletion({
        messages: [{ role: 'user', content: 'Hello' }],
      });

      expect(result).toBeNull();
    });
  });
});
