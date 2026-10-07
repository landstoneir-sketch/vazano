import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import type { AuthenticatedUser } from '../auth/auth.types';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { CreateQuotationDto } from './create-quotation.dto';
import { calculateProposalFeeCredits, calculateQuotationTotals, PROPOSAL_FEE_POLICY_VERSION, startOfTehranDay } from './quotation-policies';

@Injectable()
export class QuotationsService {
  constructor(private readonly prisma: PrismaService) {}

  async createDraft(user: AuthenticatedUser, input: CreateQuotationDto) {
    this.assertSupplierMembership(user, input.supplierOrganizationId);
    const now = new Date();
    const [supplier, rfq, invitation] = await Promise.all([
      this.prisma.organization.findUnique({ where: { id: input.supplierOrganizationId } }),
      this.prisma.rfq.findUnique({ where: { id: input.rfqId }, include: { items: true } }),
      this.prisma.rfqInvitation.findUnique({ where: { rfqId_supplierOrganizationId: { rfqId: input.rfqId, supplierOrganizationId: input.supplierOrganizationId } } }),
    ]);
    if (!supplier || supplier.kind !== 'SUPPLIER' || supplier.status !== 'ACTIVE') throw new ConflictException('حساب فروشنده فعال نیست.');
    if (!rfq) throw new NotFoundException('استعلام پیدا نشد.');
    if (rfq.lifecycleState !== 'PUBLISHED' || !['OPEN_FOR_QUOTES', 'HAS_QUOTES'].includes(rfq.operationalStatus)) {
      throw new ConflictException('این استعلام برای دریافت پیشنهاد باز نیست.');
    }
    if (rfq.responseDeadline && rfq.responseDeadline <= now) throw new ConflictException('مهلت پاسخ به استعلام پایان یافته است.');
    if (!invitation) throw new ForbiddenException('این استعلام برای فروشنده انتخاب‌شده ارسال نشده است.');
    const existingDraft = await this.prisma.quotation.findFirst({
      where: { rfqId: input.rfqId, supplierOrganizationId: input.supplierOrganizationId, status: 'DRAFT' },
    });
    if (existingDraft) throw new ConflictException('یک پیش‌نویس فعال برای این استعلام وجود دارد.');

    const rfqItems = new Map(rfq.items.map((item) => [item.id, item]));
    if (new Set(input.items.map((item) => item.rfqItemId)).size !== input.items.length) throw new BadRequestException('هر ردیف استعلام فقط یک‌بار قابل قیمت‌گذاری است.');
    for (const item of input.items) {
      const requested = rfqItems.get(item.rfqItemId);
      if (!requested) throw new BadRequestException('ردیف پیشنهاد با این استعلام مرتبط نیست.');
      const quantity = new Prisma.Decimal(item.quantity);
      if (quantity.lte(0) || quantity.gt(requested.quantity)) throw new BadRequestException('مقدار قابل تأمین باید مثبت و حداکثر برابر مقدار درخواستی باشد.');
    }

    let totals: ReturnType<typeof calculateQuotationTotals>;
    try {
      totals = calculateQuotationTotals(input);
    } catch {
      throw new BadRequestException('مقادیر تخفیف یا جمع پیشنهاد معتبر نیست.');
    }
    if (totals.finalAmountRial <= 0n) throw new BadRequestException('مبلغ نهایی پیشنهاد باید بیشتر از صفر باشد.');
    const latest = await this.prisma.quotation.aggregate({
      where: { rfqId: input.rfqId, supplierOrganizationId: input.supplierOrganizationId },
      _max: { version: true },
    });
    const version = (latest._max.version ?? 0) + 1;
    const code = `VZQ-${new Date().toISOString().slice(0, 10).replaceAll('-', '')}-${randomUUID().slice(0, 8).toUpperCase()}`;

    return this.prisma.$transaction(async (tx) => {
      const quotation = await tx.quotation.create({
        data: {
          code,
          rfqId: input.rfqId,
          supplierOrganizationId: input.supplierOrganizationId,
          createdByUserId: user.id,
          version,
          paymentTerms: input.paymentTerms,
          preparationDays: input.preparationDays,
          deliveryDate: input.deliveryDate ? new Date(input.deliveryDate) : null,
          validUntil: input.validUntil ? new Date(input.validUntil) : null,
          subtotalRial: totals.subtotalRial,
          discountRial: totals.discountRial,
          taxRial: totals.taxRial,
          packagingRial: totals.packagingRial,
          loadingRial: totals.loadingRial,
          shippingRial: totals.shippingRial,
          otherCostsRial: totals.otherCostsRial,
          finalAmountRial: totals.finalAmountRial,
          items: {
            create: input.items.map((item, index) => ({
              rfqItemId: item.rfqItemId,
              quantity: totals.items[index]!.quantity,
              unitPriceRial: totals.items[index]!.unitPriceRial,
              discountRial: totals.items[index]!.discountRial,
              lineSubtotalRial: totals.items[index]!.lineSubtotalRial,
              lineNetRial: totals.items[index]!.lineNetRial,
              isAlternative: item.isAlternative ?? false,
              offeredDescription: item.offeredDescription,
            })),
          },
        },
        include: { items: { include: { rfqItem: true } } },
      });
      await tx.auditLog.create({ data: { actorUserId: user.id, organizationId: input.supplierOrganizationId, action: 'quotation.draft.create', entityType: 'Quotation', entityId: quotation.id } });
      return quotation;
    });
  }

  async submit(user: AuthenticatedUser, quotationId: string) {
    const quotation = await this.prisma.quotation.findUnique({ where: { id: quotationId }, include: { rfq: true } });
    if (!quotation) throw new NotFoundException('پیشنهاد قیمت پیدا نشد.');
    this.assertSupplierMembership(user, quotation.supplierOrganizationId);
    if (quotation.status === 'SUBMITTED') return quotation;
    if (quotation.status !== 'DRAFT') throw new ConflictException('این پیشنهاد در وضعیت قابل ارسال نیست.');
    const now = new Date();
    if (quotation.validUntil && quotation.validUntil <= now) throw new ConflictException('اعتبار پیشنهاد باید در آینده باشد.');
    if (quotation.rfq.responseDeadline && quotation.rfq.responseDeadline <= now) throw new ConflictException('مهلت پاسخ به استعلام پایان یافته است.');

    return this.prisma.$transaction(async (tx) => {
      const subscription = await tx.subscription.findFirst({
        where: { organizationId: quotation.supplierOrganizationId, status: 'ACTIVE', startsAt: { lte: now }, expiresAt: { gt: now } },
        include: { plan: true },
        orderBy: { expiresAt: 'desc' },
      });
      if (!subscription) throw new ConflictException('برای ارسال پیشنهاد، اشتراک فعال فروشنده الزامی است.');
      const submittedToday = await tx.quotation.count({
        where: { supplierOrganizationId: quotation.supplierOrganizationId, status: { in: ['SUBMITTED', 'ACCEPTED', 'REJECTED', 'REVISED'] }, submittedAt: { gte: startOfTehranDay(now) } },
      });
      if (submittedToday >= subscription.plan.dailyProposalLimit) throw new ConflictException('سقف روزانه ارسال پیشنهاد این پلن تکمیل شده است.');
      const feeCredits = calculateProposalFeeCredits(quotation.finalAmountRial);
      const wallet = await tx.creditWallet.findUnique({ where: { organizationId: quotation.supplierOrganizationId } });
      if (!wallet || wallet.cachedBalanceCredits < feeCredits) throw new ConflictException('اعتبار حساب برای ارسال این پیشنهاد کافی نیست.');
      const debit = await tx.creditWallet.updateMany({
        where: { id: wallet.id, cachedBalanceCredits: { gte: feeCredits } },
        data: { cachedBalanceCredits: { decrement: feeCredits } },
      });
      if (debit.count !== 1) throw new ConflictException('اعتبار حساب هم‌زمان تغییر کرده است؛ دوباره تلاش کنید.');
      await tx.creditLedgerEntry.create({
        data: {
          walletId: wallet.id,
          type: 'CONSUME',
          amountCredits: -feeCredits,
          referenceType: 'Quotation',
          referenceId: quotation.id,
          idempotencyKey: `quotation:${quotation.id}:submit:v1`,
          reasonCode: 'QUOTATION_SUBMISSION_FEE',
          metadata: { policyVersion: PROPOSAL_FEE_POLICY_VERSION, finalAmountRial: quotation.finalAmountRial.toString() },
        },
      });
      await tx.quotation.updateMany({
        where: { rfqId: quotation.rfqId, supplierOrganizationId: quotation.supplierOrganizationId, status: 'SUBMITTED', id: { not: quotation.id } },
        data: { status: 'REVISED' },
      });
      const result = await tx.quotation.update({ where: { id: quotation.id }, data: { status: 'SUBMITTED', submittedAt: now } });
      await tx.rfqInvitation.update({
        where: { rfqId_supplierOrganizationId: { rfqId: quotation.rfqId, supplierOrganizationId: quotation.supplierOrganizationId } },
        data: { status: 'RESPONDED', respondedAt: now },
      });
      await tx.rfq.update({ where: { id: quotation.rfqId }, data: { operationalStatus: 'HAS_QUOTES' } });
      await tx.auditLog.create({ data: { actorUserId: user.id, organizationId: quotation.supplierOrganizationId, action: 'quotation.submit', entityType: 'Quotation', entityId: quotation.id, metadata: { feeCredits: feeCredits.toString(), policyVersion: PROPOSAL_FEE_POLICY_VERSION } } });
      await tx.outboxEvent.create({ data: { aggregateType: 'Quotation', aggregateId: quotation.id, eventType: 'ir.vazano.quotation.submitted.v1', payload: { quotationId: quotation.id, rfqId: quotation.rfqId, supplierOrganizationId: quotation.supplierOrganizationId } } });
      return result;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  async listForSupplier(user: AuthenticatedUser, organizationId: string) {
    this.assertSupplierMembership(user, organizationId);
    return this.prisma.quotation.findMany({
      where: { supplierOrganizationId: organizationId },
      include: { rfq: { select: { id: true, code: true, title: true, responseDeadline: true } }, items: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async comparison(user: AuthenticatedUser, rfqId: string) {
    const rfq = await this.findBuyerRfq(user, rfqId);
    const quotations = await this.prisma.quotation.findMany({
      where: { rfqId, status: { in: ['SUBMITTED', 'ACCEPTED', 'REJECTED'] } },
      include: {
        supplierOrganization: { select: { id: true, displayName: true, province: true, city: true } },
        items: { include: { rfqItem: { include: { category: true, unit: true } } }, orderBy: { createdAt: 'asc' } },
      },
      orderBy: [{ finalAmountRial: 'asc' }, { submittedAt: 'asc' }],
    });
    return { rfq, quotations };
  }

  async accept(user: AuthenticatedUser, quotationId: string) {
    const quotation = await this.prisma.quotation.findUnique({ where: { id: quotationId }, include: { rfq: true } });
    if (!quotation) throw new NotFoundException('پیشنهاد قیمت پیدا نشد.');
    await this.findBuyerRfq(user, quotation.rfqId);
    if (quotation.status === 'ACCEPTED') return quotation;
    if (quotation.status !== 'SUBMITTED') throw new ConflictException('فقط پیشنهاد ارسال‌شده قابل انتخاب است.');
    return this.prisma.$transaction(async (tx) => {
      const alreadyAccepted = await tx.quotation.findFirst({ where: { rfqId: quotation.rfqId, status: 'ACCEPTED' } });
      if (alreadyAccepted) throw new ConflictException('برای این استعلام قبلاً فروشنده انتخاب شده است.');
      await tx.quotation.updateMany({ where: { rfqId: quotation.rfqId, status: 'SUBMITTED', id: { not: quotation.id } }, data: { status: 'REJECTED' } });
      const result = await tx.quotation.update({ where: { id: quotation.id }, data: { status: 'ACCEPTED' } });
      await tx.rfq.update({ where: { id: quotation.rfqId }, data: { operationalStatus: 'SELLER_SELECTED', lifecycleState: 'CLOSED', closedAt: new Date() } });
      await tx.auditLog.create({ data: { actorUserId: user.id, organizationId: quotation.rfq.buyerOrganizationId, action: 'quotation.accept', entityType: 'Quotation', entityId: quotation.id } });
      await tx.outboxEvent.create({ data: { aggregateType: 'Quotation', aggregateId: quotation.id, eventType: 'ir.vazano.quotation.accepted.v1', payload: { quotationId: quotation.id, rfqId: quotation.rfqId } } });
      return result;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  private assertSupplierMembership(user: AuthenticatedUser, organizationId: string): void {
    const role = user.memberships.find((item) => item.organizationId === organizationId)?.role;
    if (!role || !['SUPPLIER_OWNER', 'SUPPLIER_MANAGER', 'SUPPLIER_SALES'].includes(role)) {
      throw new ForbiddenException('دسترسی به اطلاعات این فروشنده مجاز نیست.');
    }
  }

  private async findBuyerRfq(user: AuthenticatedUser, rfqId: string) {
    const rfq = await this.prisma.rfq.findUnique({
      where: { id: rfqId },
      include: { items: { include: { category: true, unit: true }, orderBy: { sortOrder: 'asc' } } },
    });
    if (!rfq) throw new NotFoundException('استعلام پیدا نشد.');
    const isMember = user.memberships.some((membership) => membership.organizationId === rfq.buyerOrganizationId);
    if (!isMember && !user.permissions.includes('quotation.manage')) throw new ForbiddenException('دسترسی به پیشنهادهای این استعلام مجاز نیست.');
    return rfq;
  }
}
