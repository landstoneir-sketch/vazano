import { ForbiddenException } from '@nestjs/common';
import type { PrismaService } from '../../shared/prisma/prisma.service';
import type { AuthenticatedUser } from '../auth/auth.types';
import { ReportsService } from './reports.service';

const reportReader: AuthenticatedUser = {
  id: 'report-reader',
  mobile: '09120000000',
  status: 'ACTIVE',
  permissions: ['report.read'],
  globalRoles: ['ADMIN'],
  memberships: [],
};

function createPrismaMock() {
  return {
    user: { count: jest.fn().mockResolvedValue(0) },
    organization: { count: jest.fn().mockResolvedValue(0) },
    supplierProfile: { count: jest.fn().mockResolvedValue(0) },
    rfq: {
      count: jest.fn().mockResolvedValue(0),
      groupBy: jest.fn().mockResolvedValue([]),
    },
    quotation: { count: jest.fn().mockResolvedValue(0) },
    subscription: { count: jest.fn().mockResolvedValue(0) },
    paymentIntent: { aggregate: jest.fn().mockResolvedValue({ _sum: { amountRial: null } }) },
    auditLog: { count: jest.fn().mockResolvedValue(0) },
    qualityControlRequest: { groupBy: jest.fn().mockResolvedValue([]) },
    contractRequest: { groupBy: jest.fn().mockResolvedValue([]) },
    rfqItem: { groupBy: jest.fn().mockResolvedValue([]) },
    category: { findMany: jest.fn().mockResolvedValue([]) },
  };
}

describe('ReportsService', () => {
  it('blocks managerial reports without the backend permission', async () => {
    const prisma = createPrismaMock();
    const service = new ReportsService(prisma as unknown as PrismaService);

    await expect(service.overview({ ...reportReader, permissions: [] })).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.user.count).not.toHaveBeenCalled();
  });

  it('counts only subscriptions that are active in the current time window', async () => {
    jest.useFakeTimers();
    const now = new Date('2026-10-18T08:00:00.000Z');
    jest.setSystemTime(now);
    const prisma = createPrismaMock();
    const service = new ReportsService(prisma as unknown as PrismaService);

    try {
      await service.overview(reportReader);
    }
    finally {
      jest.useRealTimers();
    }

    const [activeSubscriptionQuery] = prisma.subscription.count.mock.calls[0] as unknown as [{ where: {
      status: string;
      startsAt: { lte: Date };
      expiresAt: { gt: Date };
    } }];
    expect(activeSubscriptionQuery.where.status).toBe('ACTIVE');
    expect(activeSubscriptionQuery.where.startsAt.lte).toEqual(now);
    expect(activeSubscriptionQuery.where.expiresAt.gt).toEqual(now);
  });

  it('returns zero conversion and revenue safely when the marketplace is empty', async () => {
    const prisma = createPrismaMock();
    const service = new ReportsService(prisma as unknown as PrismaService);

    const result = await service.overview(reportReader);

    expect(result.totals.activeSubscriptions).toBe(0);
    expect(result.totals.subscriptionRevenueRial).toBe(0n);
    expect(result.rfqFunnel.selectionConversionPercent).toBe(0);
    expect(result.topCategories).toEqual([]);
  });
});
