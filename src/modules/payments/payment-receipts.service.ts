import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../shared/prisma/prisma.service';
import type { AuthenticatedUser } from '../auth/auth.types';

@Injectable()
export class PaymentReceiptsService {
  constructor(private readonly prisma: PrismaService) {}

  async getById(user: AuthenticatedUser, receiptId: string) {
    const receipt = await this.prisma.paymentReceipt.findUnique({
      where: { id: receiptId },
      include: {
        organization: { select: { id: true, displayName: true, legalName: true, nationalId: true } },
        paymentIntent: { select: { provider: true, purpose: true, providerReference: true, referenceType: true, referenceId: true } },
        subscription: { select: { plan: { select: { code: true, nameFa: true, billingCycle: true } } } },
        qualityControlRequest: { select: { rfq: { select: { code: true, title: true } } } },
      },
    });
    if (!receipt) throw new NotFoundException('رسید پرداخت پیدا نشد.');
    const isMember = user.memberships.some((membership) => membership.organizationId === receipt.organizationId);
    const canReadFinance = user.permissions.some((permission) => ['billing.read', 'billing.manage'].includes(permission));
    if (!isMember && !canReadFinance) throw new ForbiddenException('دسترسی به این رسید مجاز نیست.');
    if (receipt.paymentIntent?.purpose === 'BUYER_COMMITMENT' && receipt.paymentIntent.referenceType === 'Rfq') {
      const rfq = await this.prisma.rfq.findFirst({
        where: { id: receipt.paymentIntent.referenceId, buyerOrganizationId: receipt.organizationId },
        select: { id: true, code: true, title: true },
      });
      return { ...receipt, rfq };
    }
    return receipt;
  }
}
