import { ForbiddenException, Injectable } from '@nestjs/common';
import type { RfqOperationalStatus } from '@prisma/client';
import { PrismaService } from '../../shared/prisma/prisma.service';
import type { AuthenticatedUser } from '../auth/auth.types';

const REPORT_WINDOW_DAYS = 30;

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async overview(user: AuthenticatedUser) {
    if (!user.permissions.includes('report.read')) throw new ForbiddenException('شما مجوز مشاهده گزارش‌های مدیریتی را ندارید.');
    const since = new Date();
    since.setUTCDate(since.getUTCDate() - REPORT_WINDOW_DAYS);

    const [
      users,
      buyerOrganizations,
      supplierOrganizations,
      verifiedSuppliers,
      rfqs,
      quotations,
      activeSubscriptions,
      totalRevenue,
      newUsers,
      recentRfqs,
      recentQuotations,
      recentAcceptedQuotations,
      recentSubscriptions,
      recentRevenue,
      rfqStatuses,
      qualityControlStatuses,
      contractStatuses,
      categoryUsage,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.organization.count({ where: { kind: 'BUYER' } }),
      this.prisma.organization.count({ where: { kind: 'SUPPLIER' } }),
      this.prisma.supplierProfile.count({ where: { verificationStatus: 'VERIFIED' } }),
      this.prisma.rfq.count(),
      this.prisma.quotation.count(),
      this.prisma.subscription.count({ where: { status: 'ACTIVE' } }),
      this.prisma.paymentIntent.aggregate({ where: { status: 'SUCCEEDED', purpose: 'SUBSCRIPTION' }, _sum: { amountRial: true } }),
      this.prisma.user.count({ where: { createdAt: { gte: since } } }),
      this.prisma.rfq.count({ where: { createdAt: { gte: since } } }),
      this.prisma.quotation.count({ where: { createdAt: { gte: since } } }),
      this.prisma.auditLog.count({ where: { action: 'quotation.accept', createdAt: { gte: since } } }),
      this.prisma.subscription.count({ where: { createdAt: { gte: since } } }),
      this.prisma.paymentIntent.aggregate({ where: { status: 'SUCCEEDED', purpose: 'SUBSCRIPTION', verifiedAt: { gte: since } }, _sum: { amountRial: true } }),
      this.prisma.rfq.groupBy({ by: ['operationalStatus'], _count: { _all: true } }),
      this.prisma.qualityControlRequest.groupBy({ by: ['status'], _count: { _all: true } }),
      this.prisma.contractRequest.groupBy({ by: ['status'], _count: { _all: true } }),
      this.prisma.rfqItem.groupBy({
        by: ['categoryId'],
        where: { rfq: { createdAt: { gte: since } } },
        _count: { _all: true },
        orderBy: { _count: { categoryId: 'desc' } },
        take: 8,
      }),
    ]);

    const categories = categoryUsage.length
      ? await this.prisma.category.findMany({ where: { id: { in: categoryUsage.map((item) => item.categoryId) } }, select: { id: true, nameFa: true } })
      : [];
    const categoryNames = new Map(categories.map((category) => [category.id, category.nameFa]));
    const rfqStatusCounts = Object.fromEntries(rfqStatuses.map((item) => [item.operationalStatus, item._count._all])) as Partial<Record<RfqOperationalStatus, number>>;
    const funnel = {
      draftAndReview: this.sumStatuses(rfqStatusCounts, ['DRAFT_INCOMPLETE', 'READY_FOR_REVIEW', 'UNDER_REVIEW', 'NEEDS_CHANGES', 'WAITING_COMMITMENT', 'READY_TO_PUBLISH']),
      openForQuotes: rfqStatusCounts.OPEN_FOR_QUOTES ?? 0,
      hasQuotes: this.sumStatuses(rfqStatusCounts, ['HAS_QUOTES', 'NEGOTIATING']),
      sellerSelected: this.sumStatuses(rfqStatusCounts, ['SELLER_SELECTED', 'COMPLETED']),
      cancelledOrExpired: this.sumStatuses(rfqStatusCounts, ['CANCELLED', 'EXPIRED']),
    };
    const eligibleForSelection = Math.max(rfqs - funnel.draftAndReview - funnel.cancelledOrExpired, 0);

    return {
      generatedAt: new Date(),
      windowDays: REPORT_WINDOW_DAYS,
      totals: { users, buyerOrganizations, supplierOrganizations, verifiedSuppliers, rfqs, quotations, activeSubscriptions, subscriptionRevenueRial: totalRevenue._sum.amountRial ?? 0n },
      recent: { newUsers, rfqs: recentRfqs, quotations: recentQuotations, acceptedQuotations: recentAcceptedQuotations, subscriptions: recentSubscriptions, subscriptionRevenueRial: recentRevenue._sum.amountRial ?? 0n },
      rfqFunnel: { ...funnel, selectionConversionPercent: eligibleForSelection > 0 ? Math.round((funnel.sellerSelected / eligibleForSelection) * 1000) / 10 : 0 },
      qualityControl: Object.fromEntries(qualityControlStatuses.map((item) => [item.status, item._count._all])),
      contracts: Object.fromEntries(contractStatuses.map((item) => [item.status, item._count._all])),
      topCategories: categoryUsage.map((item) => ({ categoryId: item.categoryId, nameFa: categoryNames.get(item.categoryId) ?? 'دسته‌بندی حذف‌شده', rfqItemCount: item._count._all })),
    };
  }

  private sumStatuses(counts: Partial<Record<RfqOperationalStatus, number>>, statuses: RfqOperationalStatus[]): number {
    return statuses.reduce((total, status) => total + (counts[status] ?? 0), 0);
  }
}
