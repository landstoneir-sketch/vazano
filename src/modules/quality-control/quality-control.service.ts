import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../shared/prisma/prisma.service';
import type { AuthenticatedUser } from '../auth/auth.types';

@Injectable()
export class QualityControlService {
  constructor(private readonly prisma: PrismaService) {}

  async acceptQuote(user: AuthenticatedUser, rfqId: string) {
    const request = await this.prisma.qualityControlRequest.findUnique({
      where: { rfqId },
      include: { rfq: { select: { buyerOrganizationId: true } }, selectedQuotation: { select: { id: true, code: true } } },
    });
    if (!request) throw new NotFoundException('درخواست کنترل کیفیت برای این استعلام پیدا نشد.');
    const isBuyerMember = user.memberships.some((membership) => membership.organizationId === request.rfq.buyerOrganizationId && ['BUYER_OWNER', 'BUYER_MEMBER'].includes(membership.role));
    if (!isBuyerMember) throw new ForbiddenException('فقط اعضای سازمان خریدار می‌توانند خدمت کنترل کیفیت را تأیید کنند.');
    if (request.status === 'ACCEPTED') return request;
    if (request.status !== 'QUOTED' || !request.purchaseAmountRial || !request.feeAmountRial || !request.selectedQuotationId) {
      throw new ConflictException('مبلغ خدمت کنترل کیفیت هنوز آماده تأیید نیست.');
    }
    const purchaseAmountRial = request.purchaseAmountRial;
    const feeAmountRial = request.feeAmountRial;
    const selectedQuotationId = request.selectedQuotationId;

    return this.prisma.$transaction(async (tx) => {
      const changed = await tx.qualityControlRequest.updateMany({
        where: { id: request.id, status: 'QUOTED' },
        data: { status: 'ACCEPTED', acceptedAt: new Date() },
      });
      if (changed.count !== 1) throw new ConflictException('وضعیت درخواست هم‌زمان تغییر کرده است؛ صفحه را دوباره بارگذاری کنید.');
      await tx.auditLog.create({
        data: {
          actorUserId: user.id,
          organizationId: request.rfq.buyerOrganizationId,
          action: 'quality_control.quote.accept',
          entityType: 'QualityControlRequest',
          entityId: request.id,
          metadata: { quotationId: selectedQuotationId, purchaseAmountRial: purchaseAmountRial.toString(), feeAmountRial: feeAmountRial.toString(), feeBps: request.feeBps },
        },
      });
      await tx.outboxEvent.create({
        data: {
          aggregateType: 'QualityControlRequest',
          aggregateId: request.id,
          eventType: 'ir.vazano.quality_control.accepted.v1',
          payload: { rfqId, quotationId: selectedQuotationId, buyerOrganizationId: request.rfq.buyerOrganizationId, feeAmountRial: feeAmountRial.toString() },
        },
      });
      return tx.qualityControlRequest.findUniqueOrThrow({ where: { id: request.id }, include: { selectedQuotation: { select: { id: true, code: true } } } });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }
}
