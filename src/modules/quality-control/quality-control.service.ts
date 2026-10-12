import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, QualityControlStatus } from '@prisma/client';
import { PrismaService } from '../../shared/prisma/prisma.service';
import type { AuthenticatedUser } from '../auth/auth.types';
import { PaymentsService } from '../payments/payments.service';
import { buildPaymentReceiptSnapshot } from '../subscriptions/payment-receipt-policy';
import { UpdateQualityControlStatusDto } from './update-quality-control-status.dto';

const operationalTransitions: Readonly<Record<string, readonly QualityControlStatus[]>> = {
  ACCEPTED: ['IN_PROGRESS', 'CANCELLED'],
  IN_PROGRESS: ['COMPLETED', 'CANCELLED'],
};

@Injectable()
export class QualityControlService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly payments: PaymentsService,
    private readonly config: ConfigService,
  ) {}

  async startCheckout(user: AuthenticatedUser, rfqId: string, idempotencyKey: string) {
    const request = await this.prisma.qualityControlRequest.findUnique({
      where: { rfqId },
      include: { rfq: { select: { buyerOrganizationId: true } }, selectedQuotation: { select: { id: true, code: true } } },
    });
    if (!request) throw new NotFoundException('درخواست کنترل کیفیت برای این استعلام پیدا نشد.');
    const isBuyerMember = user.memberships.some((membership) => membership.organizationId === request.rfq.buyerOrganizationId && ['BUYER_OWNER', 'BUYER_MEMBER'].includes(membership.role));
    if (!isBuyerMember) throw new ForbiddenException('فقط اعضای سازمان خریدار می‌توانند خدمت کنترل کیفیت را تأیید کنند.');
    if (request.status !== 'QUOTED' || !request.purchaseAmountRial || !request.feeAmountRial || !request.selectedQuotationId) {
      throw new ConflictException('مبلغ خدمت کنترل کیفیت هنوز آماده پرداخت نیست یا قبلاً پرداخت شده است.');
    }

    const existing = await this.prisma.paymentIntent.findUnique({ where: { idempotencyKey } });
    if (existing && (existing.purpose !== 'QUALITY_CONTROL' || existing.referenceId !== request.id || existing.payerOrganizationId !== request.rfq.buyerOrganizationId || existing.amountRial !== request.feeAmountRial)) {
      throw new ConflictException('کلید تکرارپذیری برای پرداخت دیگری استفاده شده است.');
    }
    if (existing?.status === 'SUCCEEDED') {
      return { paymentIntentId: existing.id, alreadyPaid: true, redirectUrl: `${this.webOrigin()}/dashboard/rfqs/${rfqId}?qualityPayment=success` };
    }
    if (existing?.authority && ['REDIRECT_PENDING', 'VERIFY_PENDING'].includes(existing.status)) {
      const callbackUrl = `${this.publicApiUrl()}/v1/quality-control/zarinpal/callback`;
      return { paymentIntentId: existing.id, authority: existing.authority, redirectUrl: this.payments.redirectUrl(existing.authority, callbackUrl) };
    }

    const intent = existing ?? await this.prisma.paymentIntent.create({
      data: {
        provider: this.payments.provider,
        purpose: 'QUALITY_CONTROL',
        amountRial: request.feeAmountRial,
        payerOrganizationId: request.rfq.buyerOrganizationId,
        referenceType: 'QualityControlRequest',
        referenceId: request.id,
        idempotencyKey,
      },
    });
    try {
      const result = await this.payments.create({
        amountRial: intent.amountRial,
        description: `خدمت کنترل کیفیت استعلام ${rfqId}`,
        callbackUrl: `${this.publicApiUrl()}/v1/quality-control/zarinpal/callback`,
        mobile: user.mobile,
        orderId: request.id,
      });
      await this.prisma.paymentIntent.update({ where: { id: intent.id }, data: { authority: result.authority, status: 'REDIRECT_PENDING' } });
      return { paymentIntentId: intent.id, ...result };
    } catch (error) {
      await this.prisma.paymentIntent.update({ where: { id: intent.id }, data: { status: 'FAILED' } });
      throw error;
    }
  }

  async handlePaymentCallback(authority: string, callbackStatus: 'OK' | 'NOK') {
    const intent = await this.prisma.paymentIntent.findFirst({ where: { authority, provider: this.payments.provider, purpose: 'QUALITY_CONTROL' } });
    if (!intent) throw new NotFoundException('تراکنش کنترل کیفیت پیدا نشد.');
    if (!intent.payerOrganizationId) throw new ConflictException('سازمان پرداخت‌کننده برای تراکنش کنترل کیفیت مشخص نیست.');
    const buyerOrganizationId = intent.payerOrganizationId;
    const request = await this.prisma.qualityControlRequest.findUnique({ where: { id: intent.referenceId } });
    if (!request) throw new NotFoundException('درخواست کنترل کیفیت مرتبط با پرداخت پیدا نشد.');
    if (intent.status === 'SUCCEEDED') return { success: true, alreadyVerified: true, referenceId: intent.providerReference, rfqId: request.rfqId };
    if (callbackStatus !== 'OK') {
      await this.prisma.paymentIntent.updateMany({ where: { id: intent.id, status: { not: 'SUCCEEDED' } }, data: { status: 'CANCELLED', callbackPayload: { status: callbackStatus } } });
      return { success: false, cancelled: true, rfqId: request.rfqId };
    }
    const verification = await this.payments.verify({ amountRial: intent.amountRial, authority });
    if (!verification.success) {
      await this.prisma.paymentIntent.updateMany({ where: { id: intent.id, status: { not: 'SUCCEEDED' } }, data: { status: 'FAILED', callbackPayload: { status: callbackStatus, code: verification.code } } });
      return { ...verification, rfqId: request.rfqId };
    }

    return this.prisma.$transaction(async (tx) => {
      const claim = await tx.paymentIntent.updateMany({ where: { id: intent.id, status: { not: 'SUCCEEDED' } }, data: { status: 'VERIFY_PENDING' } });
      if (claim.count === 0) {
        const completed = await tx.paymentIntent.findUniqueOrThrow({ where: { id: intent.id } });
        return { success: true, alreadyVerified: true, referenceId: completed.providerReference, rfqId: request.rfqId };
      }
      const paidAt = new Date();
      const changed = await tx.qualityControlRequest.updateMany({ where: { id: request.id, status: 'QUOTED' }, data: { status: 'ACCEPTED', acceptedAt: paidAt } });
      if (changed.count !== 1) throw new ConflictException('وضعیت درخواست کنترل کیفیت برای فعال‌سازی معتبر نیست.');
      const receipt = buildPaymentReceiptSnapshot(intent.id, intent.amountRial, paidAt);
      await tx.paymentReceipt.create({ data: {
        ...receipt,
        organizationId: buyerOrganizationId,
        qualityControlRequestId: request.id,
        paymentIntentId: intent.id,
        providerReference: verification.referenceId,
      } });
      await tx.paymentIntent.update({ where: { id: intent.id }, data: { status: 'SUCCEEDED', providerReference: verification.referenceId, verifiedAt: paidAt, callbackPayload: { status: callbackStatus, code: verification.code } } });
      await tx.auditLog.create({ data: { organizationId: buyerOrganizationId, action: 'quality_control.payment.verify', entityType: 'QualityControlRequest', entityId: request.id, metadata: { paymentIntentId: intent.id, receiptNumber: receipt.receiptNumber, feeAmountRial: intent.amountRial.toString() } } });
      await tx.outboxEvent.create({ data: { aggregateType: 'QualityControlRequest', aggregateId: request.id, eventType: 'ir.vazano.quality_control.accepted.v1', payload: { rfqId: request.rfqId, buyerOrganizationId, feeAmountRial: intent.amountRial.toString(), receiptNumber: receipt.receiptNumber } } });
      return { ...verification, rfqId: request.rfqId, receiptNumber: receipt.receiptNumber };
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

  private publicApiUrl(): string {
    return (this.config.get<string>('PUBLIC_API_URL') ?? 'http://localhost:3001').replace(/\/$/, '');
  }

  private webOrigin(): string {
    return (this.config.get<string>('WEB_ORIGIN') ?? 'http://localhost:3000').replace(/\/$/, '');
  }

}
