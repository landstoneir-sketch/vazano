import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AuthenticatedUser } from '../auth/auth.types';
import { PrismaService } from '../../shared/prisma/prisma.service';

@Injectable()
export class SubscriptionsService {
  constructor(private readonly prisma: PrismaService, private readonly config: ConfigService) {}

  async listPublicPlans() {
    const plans = await this.prisma.subscriptionPlan.findMany({
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
    const paymentProvider = this.config.get<string>('PAYMENT_PROVIDER', 'zarinpal');
    const onlinePaymentAvailable = paymentProvider === 'mock'
      || (paymentProvider === 'zarinpal'
        && this.config.get<string>('ZARINPAL_ENABLED') === 'true'
        && Boolean(this.config.get<string>('ZARINPAL_MERCHANT_ID')));
    return plans.map((plan) => ({ ...plan, checkoutAvailable: plan.isTrial || onlinePaymentAvailable }));
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

  listInvoicesForOrganization(user: AuthenticatedUser, organizationId: string) {
    this.requireOrganizationBillingAccess(user, organizationId);
    return this.prisma.billingInvoice.findMany({
      where: { organizationId, purpose: 'SUBSCRIPTION' },
      select: {
        id: true, invoiceNumber: true, purpose: true, status: true, netAmountRial: true, taxRial: true, totalAmountRial: true,
        currency: true, descriptionFa: true, issuedAt: true, dueAt: true, paidAt: true,
        subscription: { select: { plan: { select: { code: true, nameFa: true } } } },
        paymentIntent: { select: { providerReference: true } },
        manualRenewal: { select: { trackingNumber: true } },
      },
      orderBy: { issuedAt: 'desc' },
    });
  }

  async getInvoice(user: AuthenticatedUser, invoiceId: string) {
    const invoice = await this.prisma.billingInvoice.findUnique({
      where: { id: invoiceId },
      include: {
        organization: { select: { id: true, displayName: true, legalName: true, nationalId: true, province: true, city: true } },
        subscription: { select: {
          startsAt: true,
          expiresAt: true,
          listPriceRialSnapshot: true,
          discountRialSnapshot: true,
          discountCodeSnapshot: true,
          plan: { select: { code: true, nameFa: true, billingCycle: true } },
        } },
        paymentIntent: { select: { provider: true, providerReference: true, verifiedAt: true } },
        manualRenewal: { select: { trackingNumber: true, paidAt: true } },
      },
    });
    if (!invoice) throw new NotFoundException('صورتحساب پیدا نشد.');
    this.requireOrganizationBillingAccess(user, invoice.organizationId);
    return invoice;
  }

  private requireOrganizationBillingAccess(user: AuthenticatedUser, organizationId: string): void {
    if (!user.memberships.some((membership) => membership.organizationId === organizationId) && !user.permissions.includes('subscription.manage')) {
      throw new ForbiddenException('دسترسی به اطلاعات مالی این سازمان مجاز نیست.');
    }
  }
}
