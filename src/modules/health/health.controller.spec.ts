import { ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { ObjectStorageService } from '../attachments/object-storage.service';
import { HealthController } from './health.controller';
import { RedisRuntime } from '../../common/request-security';

function createController(databaseCheck: () => Promise<unknown>, storageCheck: () => Promise<void>, redisCheck: () => Promise<void> = () => Promise.resolve()) {
  const prisma = { $queryRaw: databaseCheck } as unknown as PrismaService;
  const storage = { checkHealth: storageCheck } as unknown as ObjectStorageService;
  const redis = { ping: redisCheck } as unknown as RedisRuntime;
  return new HealthController(prisma, storage, redis);
}

describe('HealthController', () => {
  it('keeps liveness independent from external dependencies', () => {
    expect(createController(() => Promise.reject(new Error('down')), () => Promise.reject(new Error('down'))).live().status).toBe('ok');
  });

  it('reports readiness only when database and object storage are available', async () => {
    await expect(createController(() => Promise.resolve(1), () => Promise.resolve()).ready()).resolves.toMatchObject({ status: 'ok', dependencies: { database: 'ok', objectStorage: 'ok', redis: 'ok' } });
  });

  it('rejects readiness when a required dependency is unavailable', async () => {
    await expect(createController(() => Promise.resolve(1), () => Promise.reject(new Error('storage down'))).ready()).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('rejects readiness when Redis is unavailable', async () => {
    await expect(createController(() => Promise.resolve(1), () => Promise.resolve(), () => Promise.reject(new Error('redis down'))).ready()).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});
