import { ForbiddenException, Injectable } from '@nestjs/common';
import type { AuthenticatedUser } from '../auth/auth.types';
import { PrismaService } from '../../shared/prisma/prisma.service';

@Injectable()
export class SubscriptionsService {
  constructor(private readonly prisma: PrismaService) {}

  listPublicPlans() {
    return this.prisma.subscriptionPlan.findMany({
      where: { isActive: true, isPublic: true },
      orderBy: { priceRial: 'asc' },
      select: {
        id: true,
        code: true,
        nameFa: true,
        descriptionFa: true,
        billingCycle: true,
        durationIso: true,
        priceRial: true,
        grantCredits: true,
        dailyProposalLimit: true,
        maxProposalLimit: true,
        taxIncluded: true,
        isTrial: true,
        entitlements: true,
        version: true,
      },
    });
  }

  listForOrganization(user: AuthenticatedUser, organizationId: string) {
    this.requireOrganizationBillingAccess(user, organizationId);
    return this.prisma.subscription.findMany({
      where: { organizationId },
      include: { plan: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  listReceiptsForOrganization(user: AuthenticatedUser, organizationId: string) {
    this.requireOrganizationBillingAccess(user, organizationId);
    return this.prisma.paymentReceipt.findMany({
      where: { organizationId, subscriptionId: { not: null } },
      select: {
        id: true,
        receiptNumber: true,
        amountRial: true,
        taxRial: true,
        currency: true,
        providerReference: true,
        paidAt: true,
        subscription: { select: { plan: { select: { code: true, nameFa: true } } } },
      },
      orderBy: { paidAt: 'desc' },
    });
  }

  private requireOrganizationBillingAccess(user: AuthenticatedUser, organizationId: string): void {
    if (!user.memberships.some((membership) => membership.organizationId === organizationId) && !user.permissions.includes('subscription.manage')) {
      throw new ForbiddenException('دسترسی به اطلاعات مالی این سازمان مجاز نیست.');
    }
  }
}
