import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, QualityControlStatus } from '@prisma/client';
import { PrismaService } from '../../shared/prisma/prisma.service';
import type { AuthenticatedUser } from '../auth/auth.types';
import { UpdateQualityControlStatusDto } from './update-quality-control-status.dto';

const operationalTransitions: Readonly<Record<string, readonly QualityControlStatus[]>> = {
  ACCEPTED: ['IN_PROGRESS', 'CANCELLED'],
  IN_PROGRESS: ['COMPLETED', 'CANCELLED'],
};

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

  listForAdmin(user: AuthenticatedUser, status?: QualityControlStatus) {
    this.requireManagePermission(user);
    if (status && !Object.values(QualityControlStatus).includes(status)) throw new BadRequestException('وضعیت کنترل کیفیت معتبر نیست.');
    return this.prisma.qualityControlRequest.findMany({
      where: status ? { status } : { status: { in: ['ACCEPTED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'] } },
      include: {
        rfq: { select: { id: true, code: true, title: true, buyerOrganization: { select: { id: true, displayName: true } } } },
        selectedQuotation: { select: { id: true, code: true, supplierOrganization: { select: { id: true, displayName: true } } } },
      },
      orderBy: [{ status: 'asc' }, { requestedAt: 'asc' }],
      take: 200,
    });
  }

  async updateOperationalStatus(user: AuthenticatedUser, requestId: string, input: UpdateQualityControlStatusDto) {
    this.requireManagePermission(user);
    const request = await this.prisma.qualityControlRequest.findUnique({ where: { id: requestId }, include: { rfq: { select: { buyerOrganizationId: true } } } });
    if (!request) throw new NotFoundException('درخواست کنترل کیفیت پیدا نشد.');
    const allowed = operationalTransitions[request.status] ?? [];
    if (!allowed.includes(input.status)) throw new BadRequestException('این تغییر وضعیت برای درخواست کنترل کیفیت مجاز نیست.');
    if (input.status === 'CANCELLED' && !input.note?.trim()) throw new BadRequestException('ثبت دلیل لغو الزامی است.');

    return this.prisma.$transaction(async (tx) => {
      const changed = await tx.qualityControlRequest.updateMany({
        where: { id: request.id, status: request.status },
        data: { status: input.status, completedAt: input.status === 'COMPLETED' ? new Date() : null },
      });
      if (changed.count !== 1) throw new ConflictException('وضعیت درخواست هم‌زمان تغییر کرده است؛ فهرست را دوباره بارگذاری کنید.');
      await tx.auditLog.create({
        data: { actorUserId: user.id, organizationId: request.rfq.buyerOrganizationId, action: `quality_control.status.${input.status.toLowerCase()}`, entityType: 'QualityControlRequest', entityId: request.id, metadata: { previousStatus: request.status, note: input.note?.trim() || null } },
      });
      await tx.outboxEvent.create({
        data: { aggregateType: 'QualityControlRequest', aggregateId: request.id, eventType: `ir.vazano.quality_control.${input.status.toLowerCase()}.v1`, payload: { requestId: request.id, rfqId: request.rfqId, buyerOrganizationId: request.rfq.buyerOrganizationId, note: input.note?.trim() || null } },
      });
      return tx.qualityControlRequest.findUniqueOrThrow({ where: { id: request.id } });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  private requireManagePermission(user: AuthenticatedUser) {
    if (!user.permissions.includes('quality_control.manage')) throw new ForbiddenException('شما مجوز مدیریت خدمات کنترل کیفیت را ندارید.');
  }
}
