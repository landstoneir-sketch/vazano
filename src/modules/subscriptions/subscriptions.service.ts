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
        entitlements: true,
        version: true,
      },
    });
  }

  listForOrganization(user: AuthenticatedUser, organizationId: string) {
    if (!user.memberships.some((membership) => membership.organizationId === organizationId) && !user.permissions.includes('subscription.manage')) {
      throw new ForbiddenException('دسترسی به اشتراک این سازمان مجاز نیست.');
    }
    return this.prisma.subscription.findMany({
      where: { organizationId },
      include: { plan: true },
      orderBy: { createdAt: 'desc' },
    });
  }
}
