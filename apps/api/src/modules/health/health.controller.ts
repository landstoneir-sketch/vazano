import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { ObjectStorageService } from '../attachments/object-storage.service';

type HealthResponse = { status: 'ok'; timestamp: string };
type ReadinessResponse = HealthResponse & { dependencies: { database: 'ok'; objectStorage: 'ok' } };

@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService, private readonly storage: ObjectStorageService) {}

  @Get('live')
  live(): HealthResponse {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }

  @Get('ready')
  async ready(): Promise<ReadinessResponse> {
    const checks = await Promise.allSettled([this.prisma.$queryRaw`SELECT 1`, this.storage.checkHealth()]);
    if (checks.some((result) => result.status === 'rejected')) throw new ServiceUnavailableException('سامانه هنوز آماده دریافت ترافیک نیست.');
    return { status: 'ok', dependencies: { database: 'ok', objectStorage: 'ok' }, timestamp: new Date().toISOString() };
  }

  @Get()
  check(): Promise<ReadinessResponse> {
    return this.ready();
  }
}
