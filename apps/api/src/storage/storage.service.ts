import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly s3: S3Client | null;
  private readonly bucket: string;
  private readonly publicUrl: string;

  constructor(private configService: ConfigService) {
    const accountId = this.configService.get<string>('r2.accountId');
    const accessKeyId = this.configService.get<string>('r2.accessKeyId');
    const secretAccessKey = this.configService.get<string>('r2.secretAccessKey');

    this.bucket = this.configService.get<string>('r2.bucketName', 'jyotryx-uploads');
    this.publicUrl = this.configService.get<string>('r2.publicUrl', '');

    if (accountId && accessKeyId && secretAccessKey) {
      this.s3 = new S3Client({
        region: 'auto',
        endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
        credentials: { accessKeyId, secretAccessKey },
      });
      this.logger.log('R2 storage client initialized');
    } else {
      this.s3 = null;
      this.logger.warn('R2 credentials not configured — file uploads will be skipped');
    }
  }

  isAvailable(): boolean {
    return this.s3 != null;
  }

  async uploadBuffer(key: string, buffer: Buffer, contentType: string): Promise<string> {
    if (!this.s3) throw new Error('Storage not configured');

    await this.s3.send(new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      Body: buffer,
      ContentType: contentType,
    }));

    return key;
  }

  async getPresignedDownloadUrl(key: string, expiresIn = 3600): Promise<string> {
    if (!this.s3) throw new Error('Storage not configured');

    return getSignedUrl(
      this.s3,
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
      { expiresIn },
    );
  }

  async getPresignedUploadUrl(key: string, contentType: string, maxSize = 10 * 1024 * 1024): Promise<string> {
    if (!this.s3) throw new Error('Storage not configured');

    return getSignedUrl(
      this.s3,
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        ContentType: contentType,
        ContentLength: maxSize,
      }),
      { expiresIn: 600 },
    );
  }

  async deleteObject(key: string): Promise<void> {
    if (!this.s3) return;

    await this.s3.send(new DeleteObjectCommand({
      Bucket: this.bucket,
      Key: key,
    }));
  }
}
