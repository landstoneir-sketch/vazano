import { ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { ObjectStorageService } from '../attachments/object-storage.service';
import { FileSafetyService } from '../attachments/file-safety.service';
import { HealthController } from './health.controller';
import { RedisRuntime } from '../../common/request-security';
import { ConfigService } from '@nestjs/config';

function createController(
  databaseCheck: () => Promise<unknown>,
  storageCheck: () => Promise<void>,
  redisCheck: () => Promise<void> = () => Promise.resolve(),
  scannerRequired = false,
  scannerCheck: () => Promise<void> = () => Promise.resolve(),
  releaseRevision = 'development',
) {
  const prisma = { $queryRaw: databaseCheck } as unknown as PrismaService;
  const storage = { checkHealth: storageCheck } as unknown as ObjectStorageService;
  const redis = { ping: redisCheck } as unknown as RedisRuntime;
  const fileSafety = { requiresContent: () => scannerRequired, checkHealth: scannerCheck } as unknown as FileSafetyService;
  const environment = { get: (_key: string, defaultValue: string) => releaseRevision || defaultValue } as unknown as ConfigService;
  return new HealthController(prisma, storage, redis, fileSafety, environment);
}

describe('HealthController', () => {
  it('keeps liveness independent from external dependencies', () => {
    expect(createController(() => Promise.reject(new Error('down')), () => Promise.reject(new Error('down'))).live()).toMatchObject({ status: 'ok', releaseRevision: 'development' });
  });

  it('reports readiness only when database and object storage are available', async () => {
    await expect(createController(() => Promise.resolve(1), () => Promise.resolve(), undefined, false, undefined, 'a'.repeat(40)).ready()).resolves.toMatchObject({ status: 'ok', releaseRevision: 'a'.repeat(40), dependencies: { database: 'ok', objectStorage: 'ok', redis: 'ok' } });
  });

  it('rejects readiness when a required dependency is unavailable', async () => {
    await expect(createController(() => Promise.resolve(1), () => Promise.reject(new Error('storage down'))).ready()).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('rejects readiness when Redis is unavailable', async () => {
    await expect(createController(() => Promise.resolve(1), () => Promise.resolve(), () => Promise.reject(new Error('redis down'))).ready()).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('rejects readiness when the configured malware scanner is unavailable', async () => {
    await expect(createController(
      () => Promise.resolve(1),
      () => Promise.resolve(),
      () => Promise.resolve(),
      true,
      () => Promise.reject(new Error('scanner down')),
    ).ready()).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});
