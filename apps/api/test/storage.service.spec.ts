import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { StorageService } from '../src/storage/storage.service';

describe('StorageService (Item 1 — S3/R2)', () => {
  let service: StorageService;

  describe('when R2 is not configured', () => {
    beforeEach(async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          StorageService,
          {
            provide: ConfigService,
            useValue: {
              get: jest.fn().mockReturnValue(undefined),
            },
          },
        ],
      }).compile();

      service = module.get<StorageService>(StorageService);
    });

    it('should report as unavailable', () => {
      expect(service.isAvailable()).toBe(false);
    });

    it('should throw on upload when not configured', async () => {
      await expect(
        service.uploadBuffer('test-key', Buffer.from('test'), 'image/jpeg'),
      ).rejects.toThrow();
    });
  });

  describe('when R2 is configured', () => {
    beforeEach(async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          StorageService,
          {
            provide: ConfigService,
            useValue: {
              get: jest.fn((key: string) => {
                const cfg: Record<string, any> = {
                  'r2.accountId': 'test-account',
                  'r2.accessKeyId': 'test-key-id',
                  'r2.secretAccessKey': 'test-secret',
                  'r2.bucketName': 'test-bucket',
                  'r2.publicUrl': 'https://cdn.example.com',
                };
                return cfg[key];
              }),
            },
          },
        ],
      }).compile();

      service = module.get<StorageService>(StorageService);
    });

    it('should report as available when configured', () => {
      expect(service.isAvailable()).toBe(true);
    });
  });
});
