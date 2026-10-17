import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { ObjectStorageService } from '../attachments/object-storage.service';
import { FileSafetyService } from '../attachments/file-safety.service';
import { RedisRuntime } from '../../common/request-security';

type HealthResponse = { status: 'ok'; releaseRevision: string; timestamp: string };
type ReadinessResponse = HealthResponse & {
  dependencies: { database: 'ok'; objectStorage: 'ok'; redis: 'ok'; malwareScanner: 'ok' | 'bypassed' };
};

@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: ObjectStorageService,
    private readonly redis: RedisRuntime,
    private readonly fileSafety: FileSafetyService,
    private readonly environment: ConfigService,
  ) {}

  @Get('live')
  live(): HealthResponse {
    return { status: 'ok', releaseRevision: this.releaseRevision(), timestamp: new Date().toISOString() };
  }

  @Get('ready')
  async ready(): Promise<ReadinessResponse> {
    const scannerRequired = this.fileSafety.requiresContent();
    const checks = await Promise.allSettled([
      this.prisma.$queryRaw`SELECT 1`,
      this.storage.checkHealth(),
      this.redis.ping(),
      ...(scannerRequired ? [this.fileSafety.checkHealth()] : []),
    ]);
    if (checks.some((result) => result.status === 'rejected')) throw new ServiceUnavailableException('سامانه هنوز آماده دریافت ترافیک نیست.');
    return {
      status: 'ok',
      releaseRevision: this.releaseRevision(),
      dependencies: { database: 'ok', objectStorage: 'ok', redis: 'ok', malwareScanner: scannerRequired ? 'ok' : 'bypassed' },
      timestamp: new Date().toISOString(),
    };
  }

  @Get()
  check(): Promise<ReadinessResponse> {
    return this.ready();
  }

  private releaseRevision(): string {
    return this.environment.get<string>('VAZANO_RELEASE_SHA', 'development');
  }
}
