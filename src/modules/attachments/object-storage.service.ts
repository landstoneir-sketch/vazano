import {
  CreateBucketCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Readable } from 'node:stream';

@Injectable()
export class ObjectStorageService implements OnModuleInit {
  readonly bucket: string;
  private readonly client: S3Client;
  private readonly uploadTtlSeconds: number;
  private readonly downloadTtlSeconds: number;

  constructor(private readonly config: ConfigService) {
    this.bucket = config.get<string>('S3_BUCKET', 'vazano-dev');
    this.uploadTtlSeconds = config.get<number>('S3_UPLOAD_URL_TTL_SECONDS', 300);
    this.downloadTtlSeconds = config.get<number>('S3_DOWNLOAD_URL_TTL_SECONDS', 300);
    this.client = new S3Client({
      region: config.get<string>('S3_REGION', 'us-east-1'),
      endpoint: config.getOrThrow<string>('S3_ENDPOINT'),
      forcePathStyle: config.get<string>('S3_FORCE_PATH_STYLE', 'true') === 'true',
      requestChecksumCalculation: 'WHEN_REQUIRED',
      responseChecksumValidation: 'WHEN_REQUIRED',
      credentials: {
        accessKeyId: config.getOrThrow<string>('S3_ACCESS_KEY'),
        secretAccessKey: config.getOrThrow<string>('S3_SECRET_KEY'),
      },
    });
  }

  async onModuleInit(): Promise<void> {
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }));
    } catch (error: unknown) {
      if (this.config.get<string>('NODE_ENV') === 'production') throw error;
      await this.client.send(new CreateBucketCommand({ Bucket: this.bucket }));
    }
  }

  async checkHealth(): Promise<void> {
    await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }));
  }

  createUploadUrl(storageKey: string, mimeType: string): Promise<string> {
    return getSignedUrl(this.client, new PutObjectCommand({ Bucket: this.bucket, Key: storageKey, ContentType: mimeType }), { expiresIn: this.uploadTtlSeconds });
  }

  createDownloadUrl(storageKey: string, originalName: string): Promise<string> {
    return getSignedUrl(this.client, new GetObjectCommand({
      Bucket: this.bucket,
      Key: storageKey,
      ResponseContentDisposition: `attachment; filename*=UTF-8''${encodeURIComponent(originalName)}`,
    }), { expiresIn: this.downloadTtlSeconds });
  }

  async inspect(storageKey: string): Promise<{ sizeBytes: number; mimeType?: string }> {
    const result = await this.client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: storageKey }));
    return { sizeBytes: result.ContentLength ?? 0, mimeType: result.ContentType };
  }

  async read(storageKey: string): Promise<Readable> {
    const result = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: storageKey }));
    if (!(result.Body instanceof Readable)) throw new Error('Object storage did not return a readable stream.');
    return result.Body;
  }

  async remove(storageKey: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: storageKey }));
  }
}
