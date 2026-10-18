import { BadRequestException, ConflictException, ForbiddenException, Injectable, Logger, NotFoundException, type OnApplicationBootstrap, type OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, RfqSource } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import type { AuthenticatedUser } from '../auth/auth.types';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { CreateRfqDto, UpdateRfqDto } from './create-rfq.dto';
import { canPublishRfq } from './rfq-policies';
import { RfqReviewDecision, ReviewRfqDto } from './review-rfq.dto';
import { PaymentsService } from '../payments/payments.service';
import { isProvinceWithinMarketCoverage, RfqPolicySettingsService } from './rfq-policy-settings.service';
import { buildPaymentReceiptSnapshot } from '../subscriptions/payment-receipt-policy';

const categoryDetailsInclude = {
  attributeBindings: {
    where: { attribute: { isActive: true } },
    include: { attribute: true },
    orderBy: { sortOrder: 'asc' as const },
  },
} as const;

@Injectable()
export class RfqsService implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(RfqsService.name);
  private lifecycleTimer?: NodeJS.Timeout;
  private lifecycleRunning = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly payments: PaymentsService,
    private readonly config: ConfigService,
    private readonly policySettings: RfqPolicySettingsService,
  ) {}

  onApplicationBootstrap(): void {
    if (this.config.get<string>('RFQ_LIFECYCLE_WORKER_ENABLED', 'true') !== 'true') return;
    void this.runLifecycleWorker();
    const intervalMs = Number(this.config.get<string>('RFQ_LIFECYCLE_WORKER_INTERVAL_MS', '60000'));
    this.lifecycleTimer = setInterval(() => void this.runLifecycleWorker(), intervalMs);
    this.lifecycleTimer.unref();
  }

  onApplicationShutdown(): void {
    if (this.lifecycleTimer) clearInterval(this.lifecycleTimer);
  }

  async processResponseDeadlines(now = new Date()): Promise<{ negotiating: number; expired: number }> {
    const candidates = await this.prisma.rfq.findMany({
      where: {
        lifecycleState: 'PUBLISHED',
        operationalStatus: { in: ['OPEN_FOR_QUOTES', 'HAS_QUOTES'] },
        responseDeadline: { lte: now },
      },
      select: { id: true, buyerOrganizationId: true, operationalStatus: true },
      orderBy: { responseDeadline: 'asc' },
      take: 100,
    });
    let negotiating = 0;
    let expired = 0;
    for (const candidate of candidates) {
      const hasQuotes = candidate.operationalStatus === 'HAS_QUOTES';
      const changed = await this.prisma.$transaction(async (tx) => {
        const update = await tx.rfq.updateMany({
          where: { id: candidate.id, lifecycleState: 'PUBLISHED', operationalStatus: candidate.operationalStatus, responseDeadline: { lte: now } },
          data: hasQuotes
            ? { operationalStatus: 'NEGOTIATING' }
            : { lifecycleState: 'EXPIRED', operationalStatus: 'EXPIRED', closedAt: now },
        });
        if (update.count !== 1) return false;
        const outcome = hasQuotes ? 'NEGOTIATING' : 'EXPIRED';
        await tx.auditLog.create({
          data: { organizationId: candidate.buyerOrganizationId, action: 'rfq.quote_window.closed', entityType: 'Rfq', entityId: candidate.id, metadata: { outcome } },
        });
        await tx.outboxEvent.create({
          data: { aggregateType: 'Rfq', aggregateId: candidate.id, eventType: 'ir.vazano.rfq.quote_window_closed.v1', payload: { rfqId: candidate.id, outcome } },
        });
        return true;
      });
      if (changed && hasQuotes) negotiating += 1;
      if (changed && !hasQuotes) expired += 1;
    }
    return { negotiating, expired };
  }

  listForUser(user: AuthenticatedUser) {
    const buyerOrganizationIds = user.memberships
      .filter((membership) => membership.role === 'BUYER_OWNER' || membership.role === 'BUYER_MEMBER')
      .map((membership) => membership.organizationId);
    return this.prisma.rfq.findMany({
      where: { buyerOrganizationId: { in: buyerOrganizationIds } },
      include: { items: { include: { category: { include: categoryDetailsInclude }, unit: true }, orderBy: { sortOrder: 'asc' } }, _count: { select: { quotations: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getActivePolicy() {
    const policy = await this.policySettings.get();
    return {
      marketCountry: policy.marketCountry,
      marketCoverageMode: policy.marketCoverageMode,
      marketCoverageProvinceCodes: policy.marketCoverageProvinceCodes,
      displayPricesTaxInclusive: policy.displayPricesTaxInclusive,
      legalRole: policy.legalRole,
      qualityControlEnabled: policy.qualityControl.enabled,
      qualityControlFeeBps: policy.qualityControl.feeBps,
      operatorEntryEnabled: policy.operatorEntryEnabled,
      pilotManualReview: policy.pilotManualReview,
      buyerCommitmentAmountRial: policy.buyerCommitment.amountRial.toString(),
    };
  }

  listMatchedForSupplier(user: AuthenticatedUser) {
    const now = new Date();
    const supplierOrganizationIds = user.memberships
      .filter((membership) => ['SUPPLIER_OWNER', 'SUPPLIER_MANAGER', 'SUPPLIER_SALES'].includes(membership.role))
      .map((membership) => membership.organizationId);
    return this.prisma.rfqInvitation.findMany({
      where: {
        supplierOrganizationId: { in: supplierOrganizationIds },
        status: { in: ['INVITED', 'VIEWED', 'RESPONDED'] },
        rfq: {
          lifecycleState: 'PUBLISHED',
          operationalStatus: { in: ['OPEN_FOR_QUOTES', 'HAS_QUOTES'] },
          OR: [{ responseDeadline: null }, { responseDeadline: { gt: now } }],
        },
      },
      include: {
        supplierOrganization: { select: { id: true, displayName: true } },
        rfq: {
          include: {
            buyerOrganization: { select: { id: true, displayName: true, province: true, city: true } },
            items: { include: { category: { include: categoryDetailsInclude }, unit: true }, orderBy: { sortOrder: 'asc' } },
            quotations: { where: { supplierOrganizationId: { in: supplierOrganizationIds } }, select: { id: true, status: true, version: true, finalAmountRial: true } },
          },
        },
      },
      orderBy: { invitedAt: 'desc' },
    });
  }

  async declineInvitation(user: AuthenticatedUser, invitationId: string) {
    const invitation = await this.prisma.rfqInvitation.findUnique({
      where: { id: invitationId },
      include: { rfq: { select: { id: true, lifecycleState: true, operationalStatus: true, responseDeadline: true } } },
    });
    if (!invitation) throw new NotFoundException('دعوت استعلام پیدا نشد.');
    const hasSupplierAccess = user.memberships.some((membership) =>
      membership.organizationId === invitation.supplierOrganizationId
      && ['SUPPLIER_OWNER', 'SUPPLIER_MANAGER', 'SUPPLIER_SALES'].includes(membership.role));
    if (!hasSupplierAccess) throw new ForbiddenException('دسترسی به این دعوت استعلام مجاز نیست.');
    if (invitation.status === 'DECLINED') return invitation;
    if (!['INVITED', 'VIEWED'].includes(invitation.status)) {
      throw new ConflictException('این دعوت پس از ثبت پاسخ قابل ردکردن نیست.');
    }
    const now = new Date();
    if (invitation.rfq.lifecycleState !== 'PUBLISHED'
      || !['OPEN_FOR_QUOTES', 'HAS_QUOTES'].includes(invitation.rfq.operationalStatus)
      || (invitation.rfq.responseDeadline && invitation.rfq.responseDeadline <= now)) {
      throw new ConflictException('مهلت پاسخ‌گویی به این استعلام پایان یافته است.');
    }
    const activeQuotation = await this.prisma.quotation.findFirst({
      where: {
        rfqId: invitation.rfqId,
        supplierOrganizationId: invitation.supplierOrganizationId,
        status: { in: ['DRAFT', 'SUBMITTED', 'REVISED', 'ACCEPTED'] },
      },
      select: { id: true },
    });
    if (activeQuotation) throw new ConflictException('برای این استعلام پیشنهاد فعال دارید و دعوت قابل ردکردن نیست.');

    return this.prisma.$transaction(async (tx) => {
      const changed = await tx.rfqInvitation.updateMany({
        where: { id: invitation.id, status: { in: ['INVITED', 'VIEWED'] } },
        data: { status: 'DECLINED', declinedAt: now },
      });
      if (changed.count !== 1) {
        const current = await tx.rfqInvitation.findUniqueOrThrow({ where: { id: invitation.id } });
        if (current.status === 'DECLINED') return current;
        throw new ConflictException('وضعیت دعوت هم‌زمان تغییر کرده است؛ صفحه را تازه‌سازی کنید.');
      }
      await tx.auditLog.create({
        data: {
          actorUserId: user.id,
          organizationId: invitation.supplierOrganizationId,
          action: 'rfq.invitation.decline',
          entityType: 'RfqInvitation',
          entityId: invitation.id,
          metadata: { rfqId: invitation.rfqId },
        },
      });
      await tx.outboxEvent.create({
        data: {
          aggregateType: 'RfqInvitation',
          aggregateId: invitation.id,
          eventType: 'ir.vazano.rfq.invitation.declined.v1',
          payload: { invitationId: invitation.id, rfqId: invitation.rfqId, supplierOrganizationId: invitation.supplierOrganizationId },
        },
      });
      return tx.rfqInvitation.findUniqueOrThrow({ where: { id: invitation.id } });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  async markInvitationViewed(user: AuthenticatedUser, rfqId: string, supplierOrganizationId: string) {
    const hasSupplierAccess = user.memberships.some((membership) =>
      membership.organizationId === supplierOrganizationId
      && ['SUPPLIER_OWNER', 'SUPPLIER_MANAGER', 'SUPPLIER_SALES'].includes(membership.role));
    if (!hasSupplierAccess) throw new ForbiddenException('دسترسی به این دعوت استعلام مجاز نیست.');
    const invitation = await this.prisma.rfqInvitation.findUnique({
      where: { rfqId_supplierOrganizationId: { rfqId, supplierOrganizationId } },
    });
    if (!invitation) throw new NotFoundException('دعوت استعلام پیدا نشد.');
    if (['VIEWED', 'RESPONDED'].includes(invitation.status)) return invitation;
    if (invitation.status !== 'INVITED') throw new ConflictException('این دعوت دیگر فعال نیست.');
    const viewedAt = new Date();
    const changed = await this.prisma.rfqInvitation.updateMany({
      where: { id: invitation.id, status: 'INVITED' },
      data: { status: 'VIEWED', viewedAt },
    });
    if (changed.count !== 1) return this.prisma.rfqInvitation.findUniqueOrThrow({ where: { id: invitation.id } });
    return { ...invitation, status: 'VIEWED' as const, viewedAt };
  }

  async cancel(user: AuthenticatedUser, rfqId: string, rawReason: string) {
    const rfq = await this.findAuthorizedRfq(user, rfqId);
    const isBuyerMember = user.memberships.some((membership) => membership.organizationId === rfq.buyerOrganizationId);
    if (!isBuyerMember && !user.permissions.includes('rfq.manage')) {
      throw new ForbiddenException('لغو این استعلام برای شما مجاز نیست.');
    }
    if (rfq.lifecycleState === 'CANCELLED') return { rfq, refundedCredits: '0' };
    if (!['DRAFT', 'SUBMITTED', 'PUBLISHED'].includes(rfq.lifecycleState)) {
      throw new ConflictException('این استعلام در وضعیت فعلی قابل لغو نیست.');
    }
    if (['PAYMENT_PENDING', 'HELD', 'REFUND_PENDING'].includes(rfq.commitmentStatus)) {
      throw new ConflictException('این استعلام دارای فرایند مالی فعال است؛ لغو باید توسط پشتیبانی و پس از تعیین تکلیف وجه انجام شود.');
    }
    const reason = rawReason.trim();

    return this.prisma.$transaction(async (tx) => {
      const activeQuotations = await tx.quotation.findMany({
        where: { rfqId: rfq.id, status: { in: ['DRAFT', 'SUBMITTED', 'REVISED'] } },
        select: { id: true, status: true, supplierOrganizationId: true },
      });
      const acceptedQuotation = await tx.quotation.findFirst({ where: { rfqId: rfq.id, status: 'ACCEPTED' }, select: { id: true } });
      if (acceptedQuotation) throw new ConflictException('پس از انتخاب فروشنده، لغو استعلام فقط از مسیر پشتیبانی امکان‌پذیر است.');
      const chargedQuotationIds = activeQuotations.filter((quotation) => ['SUBMITTED', 'REVISED'].includes(quotation.status)).map((quotation) => quotation.id);
      const feeEntries = chargedQuotationIds.length === 0 ? [] : await tx.creditLedgerEntry.findMany({
        where: { idempotencyKey: { in: chargedQuotationIds.map((id) => `quotation:${id}:submit:v1`) } },
        select: { walletId: true, amountCredits: true, referenceId: true, idempotencyKey: true },
      });
      const activeInvitations = await tx.rfqInvitation.findMany({
        where: { rfqId: rfq.id, status: { in: ['INVITED', 'VIEWED', 'RESPONDED'] } },
        select: { supplierOrganizationId: true },
      });
      const changed = await tx.rfq.updateMany({
        where: { id: rfq.id, lifecycleState: rfq.lifecycleState, operationalStatus: rfq.operationalStatus },
        data: { lifecycleState: 'CANCELLED', operationalStatus: 'CANCELLED', closedAt: new Date() },
      });
      if (changed.count !== 1) throw new ConflictException('وضعیت استعلام هم‌زمان تغییر کرده است؛ صفحه را تازه‌سازی کنید.');
      await tx.rfqInvitation.updateMany({
        where: { rfqId: rfq.id, status: { in: ['INVITED', 'VIEWED', 'RESPONDED'] } },
        data: { status: 'EXPIRED' },
      });
      await tx.quotation.updateMany({
        where: { id: { in: activeQuotations.map((quotation) => quotation.id) } },
        data: { status: 'EXPIRED' },
      });
      await tx.qualityControlRequest.updateMany({ where: { rfqId: rfq.id, status: 'REQUESTED' }, data: { status: 'CANCELLED' } });

      let refundedCredits = 0n;
      for (const feeEntry of feeEntries) {
        if (feeEntry.amountCredits >= 0n) continue;
        const refund = -feeEntry.amountCredits;
        await tx.creditWallet.update({ where: { id: feeEntry.walletId }, data: { cachedBalanceCredits: { increment: refund } } });
        await tx.creditLedgerEntry.create({
          data: {
            walletId: feeEntry.walletId,
            type: 'REFUND',
            amountCredits: refund,
            referenceType: 'Quotation',
            referenceId: feeEntry.referenceId,
            idempotencyKey: `quotation:${feeEntry.referenceId}:rfq-cancelled-refund:v1`,
            reasonCode: 'RFQ_CANCELLED_FULL_REFUND',
            metadata: { originalDebitIdempotencyKey: feeEntry.idempotencyKey },
          },
        });
        refundedCredits += refund;
      }
      const supplierOrganizationIds = [...new Set(activeInvitations.map((invitation) => invitation.supplierOrganizationId))];
      await tx.auditLog.create({
        data: {
          actorUserId: user.id,
          organizationId: rfq.buyerOrganizationId,
          action: 'rfq.cancel',
          entityType: 'Rfq',
          entityId: rfq.id,
          metadata: { reason, expiredQuotations: activeQuotations.length, refundedCredits: refundedCredits.toString() },
        },
      });
      await tx.outboxEvent.create({
        data: {
          aggregateType: 'Rfq',
          aggregateId: rfq.id,
          eventType: 'ir.vazano.rfq.cancelled.v1',
          payload: { rfqId: rfq.id, supplierOrganizationIds, refundedCredits: refundedCredits.toString() },
        },
      });
      const updated = await tx.rfq.findUniqueOrThrow({ where: { id: rfq.id }, include: { items: true } });
      return { rfq: updated, refundedCredits: refundedCredits.toString() };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  async getOne(user: AuthenticatedUser, rfqId: string) {
    const rfq = await this.prisma.rfq.findUnique({
      where: { id: rfqId },
      include: {
        buyerOrganization: { select: { id: true, displayName: true, province: true, city: true } },
        items: { include: { category: { include: categoryDetailsInclude }, unit: true }, orderBy: { sortOrder: 'asc' } },
        invitations: { select: { supplierOrganizationId: true, status: true } },
        _count: { select: { quotations: true } },
      },
    });
    if (!rfq) throw new NotFoundException('استعلام پیدا نشد.');
    const buyerAccess = user.memberships.some((membership) => membership.organizationId === rfq.buyerOrganizationId);
    const supplierOrganizationIds = user.memberships
      .filter((membership) => ['SUPPLIER_OWNER', 'SUPPLIER_MANAGER', 'SUPPLIER_SALES'].includes(membership.role))
      .map((membership) => membership.organizationId);
    const supplierAccess = rfq.invitations.some((invitation) => supplierOrganizationIds.includes(invitation.supplierOrganizationId));
    if (!buyerAccess && !supplierAccess && !user.permissions.includes('rfq.manage')) throw new NotFoundException('استعلام پیدا نشد.');
    return rfq;
  }

  listReviewQueue(user: AuthenticatedUser) {
    if (!user.permissions.includes('rfq.review')) throw new ForbiddenException('مجوز مشاهده صف بررسی را ندارید.');
    return this.prisma.rfq.findMany({
      where: {
        OR: [
          { approvalStatus: 'PENDING', operationalStatus: 'UNDER_REVIEW' },
          { approvalStatus: 'APPROVED', operationalStatus: { in: ['WAITING_COMMITMENT', 'READY_TO_PUBLISH'] } },
        ],
      },
      include: {
        buyerOrganization: { select: { id: true, displayName: true, province: true, city: true } },
        buyerContact: { select: { id: true, firstName: true, lastName: true, mobile: true } },
        items: { include: { category: { include: categoryDetailsInclude }, unit: true }, orderBy: { sortOrder: 'asc' } },
      },
      orderBy: { submittedAt: 'asc' },
    });
  }

  createSelfService(user: AuthenticatedUser, input: CreateRfqDto) {
    return this.create(user, input, RfqSource.BUYER_SELF_SERVICE);
  }

  async createOnBehalf(user: AuthenticatedUser, input: CreateRfqDto) {
    if (!user.permissions.includes('rfq.create_on_behalf')) {
      throw new ForbiddenException('مجوز ثبت استعلام به نمایندگی از خریدار را ندارید.');
    }
    if (!(await this.policySettings.get()).operatorEntryEnabled) {
      throw new ConflictException('ثبت استعلام توسط اپراتور در حال حاضر غیرفعال است.');
    }
    if (!input.buyerContactUserId) {
      throw new BadRequestException('انتخاب کاربر خریدار برای ثبت توسط اپراتور الزامی است.');
    }
    return this.create(user, input, RfqSource.PLATFORM_OPERATOR);
  }

  async updateDraft(user: AuthenticatedUser, rfqId: string, input: UpdateRfqDto) {
    const rfq = await this.findAuthorizedRfq(user, rfqId);
    if (rfq.lifecycleState !== 'DRAFT' || !['DRAFT_INCOMPLETE', 'NEEDS_CHANGES'].includes(rfq.operationalStatus)) {
      throw new ConflictException('فقط پیش‌نویس قابل ویرایش است.');
    }
    if (input.buyerOrganizationId !== rfq.buyerOrganizationId
      || (input.buyerContactUserId && input.buyerContactUserId !== rfq.buyerContactUserId)) {
      throw new BadRequestException('حساب خریدار و فرد تماس پس از ایجاد پیش‌نویس قابل تغییر نیستند.');
    }
    const expectedUpdatedAt = new Date(input.expectedUpdatedAt);
    if (expectedUpdatedAt.getTime() !== rfq.updatedAt.getTime()) {
      throw new ConflictException('این پیش‌نویس در جای دیگری تغییر کرده است؛ صفحه را تازه‌سازی کنید.');
    }

    const policy = await this.policySettings.get();
    if (input.qualityControlRequested && !policy.qualityControl.enabled) {
      throw new ConflictException('خدمت کنترل کیفیت در حال حاضر غیرفعال است.');
    }
    const domain = await this.prisma.industry.findFirst({ where: { id: input.primaryDomainId, isActive: true } });
    if (!domain) throw new BadRequestException('حوزه اصلی معتبر نیست.');
    await this.validateItems(input.primaryDomainId, input);
    const deliveryLocation = await this.resolveDeliveryLocation(input);
    if (!isProvinceWithinMarketCoverage(policy, deliveryLocation.provinceCode)) {
      throw new BadRequestException('استان تحویل خارج از محدوده جغرافیایی فعال وازانو است.');
    }
    const now = new Date();
    const requiredAt = input.requiredAt ? new Date(input.requiredAt) : rfq.requiredAt;
    const responseDeadline = input.responseDeadline ? new Date(input.responseDeadline) : rfq.responseDeadline;
    if (requiredAt && requiredAt <= now) throw new BadRequestException('زمان موردنیاز باید در آینده باشد.');
    if (responseDeadline && responseDeadline <= now) throw new BadRequestException('مهلت پاسخ باید در آینده باشد.');
    if (requiredAt && responseDeadline && responseDeadline >= requiredAt) {
      throw new BadRequestException('مهلت دریافت پیشنهاد باید پیش از زمان موردنیاز باشد.');
    }
    const qualityControlRequest = await this.prisma.qualityControlRequest.findUnique({ where: { rfqId } });
    if (!input.qualityControlRequested && qualityControlRequest && qualityControlRequest.status !== 'REQUESTED') {
      throw new ConflictException('پس از شروع فرایند کنترل کیفیت، لغو آن فقط توسط پشتیبانی امکان‌پذیر است.');
    }

    return this.prisma.$transaction(async (tx) => {
      const updatedAt = new Date();
      const changed = await tx.rfq.updateMany({
        where: {
          id: rfq.id,
          lifecycleState: 'DRAFT',
          operationalStatus: rfq.operationalStatus,
          updatedAt: expectedUpdatedAt,
        },
        data: {
          primaryDomainId: input.primaryDomainId,
          title: input.title,
          description: input.description === undefined ? rfq.description : input.description,
          entryMethod: input.entryMethod ?? rfq.entryMethod,
          deliveryProvinceId: deliveryLocation.provinceId,
          deliveryCityId: deliveryLocation.cityId,
          deliveryProvince: deliveryLocation.provinceName,
          deliveryCity: deliveryLocation.cityName,
          requiredAt,
          responseDeadline,
          installationRequired: input.installationRequired ?? false,
          qualityControlRequested: input.qualityControlRequested ?? false,
          qualityControlFeeBps: input.qualityControlRequested ? policy.qualityControl.feeBps : null,
          updatedAt,
        },
      });
      if (changed.count !== 1) {
        throw new ConflictException('این پیش‌نویس هم‌زمان تغییر کرده است؛ صفحه را تازه‌سازی کنید.');
      }
      await tx.rfqItem.deleteMany({ where: { rfqId: rfq.id } });
      await tx.rfqItem.createMany({
        data: input.items.map((item, index) => ({
          rfqId: rfq.id,
          categoryId: item.categoryId,
          unitId: item.unitId,
          title: item.title,
          quantity: new Prisma.Decimal(item.quantity),
          specifications: item.specifications ?? {},
          estimatedLineValueRial: item.estimatedLineValueRial ? BigInt(item.estimatedLineValueRial) : null,
          sortOrder: index,
        })),
      });
      if (input.qualityControlRequested) {
        await tx.qualityControlRequest.upsert({
          where: { rfqId: rfq.id },
          create: { rfqId: rfq.id, feeBps: policy.qualityControl.feeBps },
          update: { feeBps: policy.qualityControl.feeBps },
        });
      } else {
        await tx.qualityControlRequest.deleteMany({ where: { rfqId: rfq.id, status: 'REQUESTED' } });
      }
      await tx.auditLog.create({
        data: {
          actorUserId: user.id,
          organizationId: rfq.buyerOrganizationId,
          action: 'rfq.draft.update',
          entityType: 'Rfq',
          entityId: rfq.id,
          metadata: { previousUpdatedAt: rfq.updatedAt.toISOString(), itemCount: input.items.length },
        },
      });
      await tx.outboxEvent.create({
        data: {
          aggregateType: 'Rfq',
          aggregateId: rfq.id,
          eventType: 'ir.vazano.rfq.draft.updated.v1',
          payload: { rfqId: rfq.id, buyerOrganizationId: rfq.buyerOrganizationId },
        },
      });
      return tx.rfq.findUniqueOrThrow({
        where: { id: rfq.id },
        include: { items: true, qualityControlRequest: true },
      });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  async submit(user: AuthenticatedUser, rfqId: string) {
    const rfq = await this.findAuthorizedRfq(user, rfqId);
    if (rfq.lifecycleState !== 'DRAFT' || !['DRAFT_INCOMPLETE', 'NEEDS_CHANGES'].includes(rfq.operationalStatus)) {
      throw new ConflictException('این استعلام در وضعیت قابل ارسال نیست.');
    }
    if (rfq.items.length === 0) throw new BadRequestException('استعلام باید حداقل یک ردیف داشته باشد.');
    const now = new Date();
    const approvalStatus = rfq.manualReviewRequired ? 'PENDING' : 'APPROVED';
    const operationalStatus = rfq.manualReviewRequired
      ? 'UNDER_REVIEW'
      : (rfq.commitmentStatus === 'NOT_REQUIRED' ? 'READY_TO_PUBLISH' : 'WAITING_COMMITMENT');
    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.rfq.update({
        where: { id: rfqId },
        data: { lifecycleState: 'SUBMITTED', operationalStatus, approvalStatus, submittedAt: now },
      });
      await tx.auditLog.create({ data: { actorUserId: user.id, organizationId: rfq.buyerOrganizationId, action: rfq.manualReviewRequired ? 'rfq.submit_for_review' : 'rfq.submit_auto_approved', entityType: 'Rfq', entityId: rfqId } });
      await tx.outboxEvent.create({ data: { aggregateType: 'Rfq', aggregateId: rfqId, eventType: 'ir.vazano.rfq.submitted.v1', payload: { rfqId, manualReviewRequired: rfq.manualReviewRequired } } });
      return result;
    });
    return updated;
  }

  async review(user: AuthenticatedUser, rfqId: string, input: ReviewRfqDto) {
    if (!user.permissions.includes('rfq.review')) throw new ForbiddenException('مجوز بررسی استعلام را ندارید.');
    if (input.decision !== RfqReviewDecision.APPROVE && !input.reason) throw new BadRequestException('ثبت دلیل برای بازگشت یا رد الزامی است.');
    const rfq = await this.prisma.rfq.findUnique({ where: { id: rfqId } });
    if (!rfq) throw new NotFoundException('استعلام پیدا نشد.');
    if (rfq.lifecycleState !== 'SUBMITTED' || rfq.approvalStatus !== 'PENDING') throw new ConflictException('استعلام در صف بررسی نیست.');
    const approvalStatus = input.decision === RfqReviewDecision.APPROVE
      ? 'APPROVED'
      : (input.decision === RfqReviewDecision.NEEDS_CHANGES ? 'NEEDS_CHANGES' : 'REJECTED');
    const operationalStatus = input.decision === RfqReviewDecision.APPROVE
      ? (rfq.commitmentStatus === 'NOT_REQUIRED' ? 'READY_TO_PUBLISH' : 'WAITING_COMMITMENT')
      : (input.decision === RfqReviewDecision.NEEDS_CHANGES ? 'NEEDS_CHANGES' : 'CANCELLED');
    return this.prisma.$transaction(async (tx) => {
      const result = await tx.rfq.update({
        where: { id: rfqId },
        data: {
          approvalStatus,
          operationalStatus,
          lifecycleState: input.decision === RfqReviewDecision.REJECT ? 'CANCELLED' : (input.decision === RfqReviewDecision.NEEDS_CHANGES ? 'DRAFT' : 'SUBMITTED'),
        },
      });
      await tx.auditLog.create({ data: { actorUserId: user.id, organizationId: rfq.buyerOrganizationId, action: `rfq.review.${input.decision.toLowerCase()}`, entityType: 'Rfq', entityId: rfqId, metadata: { reason: input.reason ?? null } } });
      await tx.outboxEvent.create({ data: { aggregateType: 'Rfq', aggregateId: rfqId, eventType: `ir.vazano.rfq.reviewed.v1`, payload: { rfqId, decision: input.decision } } });
      return result;
    });
  }

  async publish(user: AuthenticatedUser, rfqId: string) {
    if (!user.permissions.includes('rfq.review')) throw new ForbiddenException('مجوز انتشار استعلام را ندارید.');
    const rfq = await this.prisma.rfq.findUnique({ where: { id: rfqId }, include: { items: true } });
    if (!rfq) throw new NotFoundException('استعلام پیدا نشد.');
    if (!canPublishRfq(rfq.approvalStatus, rfq.commitmentStatus)) throw new ConflictException('گیت تأیید یا تعهد مالی هنوز تکمیل نشده است.');
    if (rfq.lifecycleState === 'PUBLISHED') return rfq;
    const categoryIds = [...new Set(rfq.items.map((item) => item.categoryId))];
    const now = new Date();
    const suppliers = await this.prisma.supplierProfile.findMany({
      where: {
        verificationStatus: 'VERIFIED',
        organization: {
          status: 'ACTIVE',
          subscriptions: { some: { status: 'ACTIVE', startsAt: { lte: now }, expiresAt: { gt: now } } },
        },
        categories: { some: { categoryId: { in: categoryIds } } },
        ...(rfq.deliveryProvinceId
          ? { OR: [{ nationwideCoverage: true }, { serviceProvinceLinks: { some: { provinceId: rfq.deliveryProvinceId } } }] }
          : rfq.deliveryProvince
            ? { OR: [{ nationwideCoverage: true }, { serviceProvinces: { has: rfq.deliveryProvince } }] }
          : {}),
      },
      include: { categories: { where: { categoryId: { in: categoryIds } }, select: { categoryId: true } } },
    });
    return this.prisma.$transaction(async (tx) => {
      const result = await tx.rfq.update({ where: { id: rfqId }, data: { lifecycleState: 'PUBLISHED', operationalStatus: 'OPEN_FOR_QUOTES', publishedAt: new Date() } });
      for (const supplier of suppliers) {
        await tx.rfqInvitation.upsert({
          where: { rfqId_supplierOrganizationId: { rfqId, supplierOrganizationId: supplier.organizationId } },
          create: {
            rfqId,
            supplierOrganizationId: supplier.organizationId,
            matchReasons: {
              strategy: 'RULE_BASED_V1',
              categoryIds: supplier.categories.map((item) => item.categoryId),
              geography: supplier.nationwideCoverage ? 'NATIONWIDE' : rfq.deliveryProvince ?? 'UNSPECIFIED',
            },
          },
          update: {},
        });
      }
      await tx.auditLog.create({ data: { actorUserId: user.id, organizationId: rfq.buyerOrganizationId, action: 'rfq.publish', entityType: 'Rfq', entityId: rfqId } });
      await tx.outboxEvent.create({ data: { aggregateType: 'Rfq', aggregateId: rfqId, eventType: 'ir.vazano.rfq.published.v1', payload: { rfqId } } });
      await tx.outboxEvent.create({ data: { aggregateType: 'Rfq', aggregateId: rfqId, eventType: 'ir.vazano.rfq.distributed.v1', payload: { rfqId, invitedSupplierCount: suppliers.length, strategy: 'RULE_BASED_V1' } } });
      return { ...result, invitedSupplierCount: suppliers.length };
    });
  }

  async createCommitmentPayment(user: AuthenticatedUser, rfqId: string, idempotencyKey: string) {
    const rfq = await this.findAuthorizedRfq(user, rfqId);
    if (rfq.approvalStatus !== 'APPROVED' || rfq.commitmentStatus !== 'REQUIRED' || !rfq.commitmentAmountRial) {
      throw new ConflictException('این استعلام اکنون نیازمند ایجاد پرداخت تعهد نیست.');
    }
    const existing = await this.prisma.paymentIntent.findUnique({ where: { idempotencyKey } });
    if (existing && (existing.purpose !== 'BUYER_COMMITMENT' || existing.referenceId !== rfq.id || existing.amountRial !== rfq.commitmentAmountRial)) {
      throw new ConflictException('کلید تکرارپذیری برای درخواست دیگری استفاده شده است.');
    }
    if (existing && ['FAILED', 'CANCELLED'].includes(existing.status)) {
      throw new ConflictException('این تلاش پرداخت بسته شده است؛ برای پرداخت مجدد یک درخواست تازه ایجاد کنید.');
    }
    const callbackUrl = `${this.config.get<string>('PUBLIC_API_URL') ?? 'http://localhost:3001'}/v1/rfqs/commitments/zarinpal/callback`;
    if (existing?.status === 'SUCCEEDED') {
      return { paymentIntentId: existing.id, completed: true as const };
    }
    if (existing?.status === 'VERIFY_PENDING' || (existing?.status === 'REDIRECT_PENDING' && !existing.authority)) {
      return { paymentIntentId: existing.id, processing: true as const };
    }
    if (existing?.authority && existing.status === 'REDIRECT_PENDING') {
      return { paymentIntentId: existing.id, authority: existing.authority, redirectUrl: this.payments.redirectUrl(existing.authority, callbackUrl) };
    }
    const intent = existing ?? await this.prisma.paymentIntent.create({
      data: { provider: this.payments.provider, purpose: 'BUYER_COMMITMENT', amountRial: rfq.commitmentAmountRial, payerOrganizationId: rfq.buyerOrganizationId, referenceType: 'Rfq', referenceId: rfq.id, idempotencyKey },
    });
    const requestClaim = await this.prisma.paymentIntent.updateMany({
      where: { id: intent.id, status: 'CREATED', authority: null },
      data: { status: 'REDIRECT_PENDING' },
    });
    if (requestClaim.count !== 1) {
      const currentIntent = await this.prisma.paymentIntent.findUniqueOrThrow({ where: { id: intent.id } });
      if (currentIntent.status === 'SUCCEEDED') return { paymentIntentId: currentIntent.id, completed: true as const };
      if (currentIntent.authority && currentIntent.status === 'REDIRECT_PENDING') {
        return { paymentIntentId: currentIntent.id, authority: currentIntent.authority, redirectUrl: this.payments.redirectUrl(currentIntent.authority, callbackUrl) };
      }
      return { paymentIntentId: currentIntent.id, processing: true as const };
    }
    try {
      const result = await this.payments.create({ amountRial: intent.amountRial, description: `سپرده تعهد استعلام ${rfq.code}`, callbackUrl, mobile: user.mobile, orderId: intent.id });
      await this.prisma.$transaction([
        this.prisma.paymentIntent.update({ where: { id: intent.id }, data: { authority: result.authority } }),
        this.prisma.rfq.update({ where: { id: rfq.id }, data: { commitmentStatus: 'PAYMENT_PENDING' } }),
      ]);
      return { paymentIntentId: intent.id, ...result };
    } catch (error) {
      await this.prisma.paymentIntent.updateMany({ where: { id: intent.id, status: 'REDIRECT_PENDING', authority: null }, data: { status: 'FAILED' } });
      throw error;
    }
  }

  async handleCommitmentCallback(authority: string, callbackStatus: string) {
    const intent = await this.prisma.paymentIntent.findFirst({ where: { authority, provider: this.payments.provider, purpose: 'BUYER_COMMITMENT' } });
    if (!intent) throw new NotFoundException('تراکنش پرداخت پیدا نشد.');
    if (intent.status === 'SUCCEEDED') {
      const receipt = await this.prisma.paymentReceipt.findUnique({
        where: { paymentIntentId: intent.id },
        select: { id: true, receiptNumber: true },
      });
      return {
        success: true,
        alreadyVerified: true,
        referenceId: intent.providerReference,
        rfqId: intent.referenceId,
        receiptId: receipt?.id,
        receiptNumber: receipt?.receiptNumber,
      };
    }
    if (intent.status === 'CANCELLED') return { success: false, cancelled: true, rfqId: intent.referenceId };
    if (intent.status === 'FAILED') return { success: false, failed: true, rfqId: intent.referenceId };
    if (intent.status !== 'REDIRECT_PENDING') return { success: false, processing: intent.status === 'VERIFY_PENDING', rfqId: intent.referenceId };
    if (callbackStatus !== 'OK') {
      await this.prisma.$transaction(async (tx) => {
        const claim = await tx.paymentIntent.updateMany({ where: { id: intent.id, status: 'REDIRECT_PENDING' }, data: { status: 'CANCELLED', callbackPayload: { status: callbackStatus } } });
        if (claim.count === 1) await tx.rfq.update({ where: { id: intent.referenceId }, data: { commitmentStatus: 'REQUIRED' } });
      });
      return { success: false, cancelled: true, rfqId: intent.referenceId };
    }
    const verification = await this.payments.verify({ amountRial: intent.amountRial, authority });
    if (!verification.success) {
      await this.prisma.$transaction(async (tx) => {
        const claim = await tx.paymentIntent.updateMany({ where: { id: intent.id, status: 'REDIRECT_PENDING' }, data: { status: 'FAILED', callbackPayload: { status: callbackStatus, code: verification.code } } });
        if (claim.count === 1) await tx.rfq.update({ where: { id: intent.referenceId }, data: { commitmentStatus: 'REQUIRED' } });
      });
      return { ...verification, rfqId: intent.referenceId };
    }
    return this.prisma.$transaction(async (tx) => {
      const claim = await tx.paymentIntent.updateMany({ where: { id: intent.id, status: 'REDIRECT_PENDING' }, data: { status: 'VERIFY_PENDING' } });
      if (claim.count === 0) {
        const completed = await tx.paymentIntent.findUniqueOrThrow({ where: { id: intent.id } });
        if (completed.status === 'SUCCEEDED') {
          const receipt = await tx.paymentReceipt.findUnique({
            where: { paymentIntentId: intent.id },
            select: { id: true, receiptNumber: true },
          });
          return {
            success: true,
            alreadyVerified: true,
            referenceId: completed.providerReference,
            rfqId: intent.referenceId,
            receiptId: receipt?.id,
            receiptNumber: receipt?.receiptNumber,
          };
        }
        return {
          success: false,
          cancelled: completed.status === 'CANCELLED',
          failed: completed.status === 'FAILED',
          processing: completed.status === 'VERIFY_PENDING',
          rfqId: intent.referenceId,
        };
      }
      if (!intent.payerOrganizationId) throw new ConflictException('سازمان پرداخت‌کننده برای این تراکنش ثبت نشده است.');
      const paidAt = new Date();
      const receiptSnapshot = buildPaymentReceiptSnapshot(intent.id, intent.amountRial, paidAt);
      const receipt = await tx.paymentReceipt.create({ data: {
        ...receiptSnapshot,
        organizationId: intent.payerOrganizationId,
        paymentIntentId: intent.id,
        providerReference: verification.referenceId,
      } });
      await tx.paymentIntent.update({ where: { id: intent.id }, data: { status: 'SUCCEEDED', providerReference: verification.referenceId, verifiedAt: paidAt, callbackPayload: { status: callbackStatus, code: verification.code } } });
      await tx.rfq.update({ where: { id: intent.referenceId }, data: { commitmentStatus: 'HELD', operationalStatus: 'READY_TO_PUBLISH' } });
      await tx.auditLog.create({ data: { organizationId: intent.payerOrganizationId, action: 'rfq.commitment.held', entityType: 'Rfq', entityId: intent.referenceId, metadata: { paymentIntentId: intent.id, providerReference: verification.referenceId, receiptNumber: receipt.receiptNumber } } });
      await tx.outboxEvent.create({ data: { aggregateType: 'Rfq', aggregateId: intent.referenceId, eventType: 'ir.vazano.buyer.commitment.held.v1', payload: { rfqId: intent.referenceId, paymentIntentId: intent.id, receiptNumber: receipt.receiptNumber } } });
      return { ...verification, rfqId: intent.referenceId, receiptId: receipt.id, receiptNumber: receipt.receiptNumber };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  private async create(user: AuthenticatedUser, input: CreateRfqDto, source: RfqSource) {
    const policy = await this.policySettings.get();
    if (input.qualityControlRequested && !policy.qualityControl.enabled) {
      throw new ConflictException('خدمت کنترل کیفیت در حال حاضر غیرفعال است.');
    }
    const organization = await this.prisma.organization.findUnique({ where: { id: input.buyerOrganizationId } });
    if (!organization || organization.kind !== 'BUYER' || organization.status !== 'ACTIVE') throw new NotFoundException('سازمان خریدار فعال پیدا نشد.');

    const buyerContactUserId = source === RfqSource.PLATFORM_OPERATOR ? input.buyerContactUserId! : user.id;
    const membership = await this.prisma.organizationMember.findFirst({
      where: { organizationId: input.buyerOrganizationId, userId: buyerContactUserId, status: 'ACTIVE', role: { in: ['BUYER_OWNER', 'BUYER_MEMBER'] } },
    });
    if (!membership) throw new ForbiddenException('کاربر خریدار عضو فعال این سازمان نیست.');
    if (source === RfqSource.BUYER_SELF_SERVICE && buyerContactUserId !== user.id) {
      throw new ForbiddenException('ثبت استعلام فقط برای سازمان خودتان مجاز است.');
    }

    const domain = await this.prisma.industry.findFirst({ where: { id: input.primaryDomainId, isActive: true } });
    if (!domain) throw new BadRequestException('حوزه اصلی معتبر نیست.');
    await this.validateItems(input.primaryDomainId, input);
    const deliveryLocation = await this.resolveDeliveryLocation(input);
    if (!isProvinceWithinMarketCoverage(policy, deliveryLocation.provinceCode)) {
      throw new BadRequestException('استان تحویل خارج از محدوده جغرافیایی فعال وازانو است.');
    }

    const now = new Date();
    const requiredAt = input.requiredAt ? new Date(input.requiredAt) : undefined;
    const responseDeadline = input.responseDeadline ? new Date(input.responseDeadline) : undefined;
    if (requiredAt && requiredAt <= now) throw new BadRequestException('زمان موردنیاز باید در آینده باشد.');
    if (responseDeadline && responseDeadline <= now) throw new BadRequestException('مهلت پاسخ باید در آینده باشد.');
    if (requiredAt && responseDeadline && responseDeadline >= requiredAt) {
      throw new BadRequestException('مهلت دریافت پیشنهاد باید پیش از زمان موردنیاز باشد.');
    }

    const previousPublishedCount = await this.prisma.rfq.count({
      where: { buyerOrganizationId: input.buyerOrganizationId, lifecycleState: { in: ['PUBLISHED', 'CLOSED'] } },
    });
    const commitmentRequired = previousPublishedCount === 0;
    const code = `VZ-${new Date().toISOString().slice(0, 10).replaceAll('-', '')}-${randomUUID().slice(0, 8).toUpperCase()}`;

    return this.prisma.$transaction(async (tx) => {
      const rfq = await tx.rfq.create({
        data: {
          code,
          buyerOrganizationId: input.buyerOrganizationId,
          buyerContactUserId,
          createdByUserId: user.id,
          operatorUserId: source === RfqSource.PLATFORM_OPERATOR ? user.id : null,
          primaryDomainId: input.primaryDomainId,
          title: input.title,
          description: input.description,
          entryMethod: input.entryMethod ?? 'STANDARD',
          source,
          manualReviewRequired: policy.pilotManualReview,
          commitmentStatus: commitmentRequired ? 'REQUIRED' : 'NOT_REQUIRED',
          commitmentAmountRial: commitmentRequired ? policy.buyerCommitment.amountRial : null,
          commitmentPolicyVersion: commitmentRequired ? policy.buyerCommitment.policyVersion : null,
          deliveryProvinceId: deliveryLocation.provinceId,
          deliveryCityId: deliveryLocation.cityId,
          deliveryProvince: deliveryLocation.provinceName,
          deliveryCity: deliveryLocation.cityName,
          requiredAt,
          responseDeadline,
          installationRequired: input.installationRequired ?? false,
          qualityControlRequested: input.qualityControlRequested ?? false,
          qualityControlFeeBps: input.qualityControlRequested ? policy.qualityControl.feeBps : null,
          displayPricesTaxInclusive: policy.displayPricesTaxInclusive,
          items: {
            create: input.items.map((item, index) => ({
              categoryId: item.categoryId,
              unitId: item.unitId,
              title: item.title,
              quantity: new Prisma.Decimal(item.quantity),
              specifications: item.specifications ?? {},
              estimatedLineValueRial: item.estimatedLineValueRial ? BigInt(item.estimatedLineValueRial) : null,
              sortOrder: index,
            })),
          },
          qualityControlRequest: input.qualityControlRequested ? { create: { feeBps: policy.qualityControl.feeBps } } : undefined,
        },
        include: { items: true, qualityControlRequest: true },
      });
      await tx.auditLog.create({
        data: {
          actorUserId: user.id,
          organizationId: input.buyerOrganizationId,
          action: source === RfqSource.PLATFORM_OPERATOR ? 'rfq.create_on_behalf' : 'rfq.create',
          entityType: 'Rfq',
          entityId: rfq.id,
          metadata: {
            source,
            buyerContactUserId,
            manualReviewRequired: policy.pilotManualReview,
            legalRole: policy.legalRole,
            marketCountry: policy.marketCountry,
            marketCoverageMode: policy.marketCoverageMode,
          },
        },
      });
      await tx.outboxEvent.create({
        data: {
          aggregateType: 'Rfq',
          aggregateId: rfq.id,
          eventType: 'ir.vazano.rfq.draft.created.v1',
          payload: { rfqId: rfq.id, source, buyerOrganizationId: input.buyerOrganizationId },
        },
      });
      return rfq;
    });
  }

  private async resolveDeliveryLocation(input: CreateRfqDto) {
    const provinceName = input.deliveryProvince?.trim();
    const provinceRequested = input.deliveryProvinceId || provinceName;
    const cityRequested = input.deliveryCityId || input.deliveryCity?.trim();
    if (!provinceRequested && !cityRequested) return { provinceId: undefined, provinceCode: undefined, cityId: undefined, provinceName: undefined, cityName: undefined };
    if (!provinceRequested) throw new BadRequestException('برای انتخاب شهر، استان تحویل را نیز مشخص کنید.');

    const province = await this.prisma.province.findFirst({
      where: input.deliveryProvinceId ? { id: input.deliveryProvinceId, isActive: true } : { nameFa: provinceName, isActive: true },
    });
    if (!province) throw new BadRequestException('استان تحویل معتبر یا فعال نیست.');
    if (!cityRequested) return { provinceId: province.id, provinceCode: province.code, cityId: undefined, provinceName: province.nameFa, cityName: undefined };

    const cityName = input.deliveryCity?.trim();
    const city = await this.prisma.city.findFirst({
      where: input.deliveryCityId
        ? { id: input.deliveryCityId, provinceId: province.id, isActive: true }
        : { nameFa: cityName, provinceId: province.id, isActive: true },
    });
    if (!city) throw new BadRequestException('شهر تحویل با استان انتخاب‌شده مطابقت ندارد یا غیرفعال است.');
    return { provinceId: province.id, provinceCode: province.code, cityId: city.id, provinceName: province.nameFa, cityName: city.nameFa };
  }

  private async validateItems(primaryDomainId: string, input: CreateRfqDto): Promise<void> {
    const categoryIds = [...new Set(input.items.map((item) => item.categoryId))];
    const unitIds = [...new Set(input.items.map((item) => item.unitId))];
    const [categories, units, attributeBindings] = await Promise.all([
      this.prisma.category.count({ where: { id: { in: categoryIds }, industryId: primaryDomainId, isActive: true } }),
      this.prisma.unitOfMeasure.count({ where: { id: { in: unitIds }, isActive: true } }),
      this.prisma.categoryAttribute.findMany({
        where: { categoryId: { in: categoryIds }, attribute: { isActive: true } },
        include: { attribute: true },
      }),
    ]);
    if (categories !== categoryIds.length) throw new BadRequestException('یک یا چند دسته‌بندی نامعتبر است.');
    if (units !== unitIds.length) throw new BadRequestException('یک یا چند واحد اندازه‌گیری نامعتبر است.');

    for (const item of input.items) {
      const bindings = attributeBindings.filter((binding) => binding.categoryId === item.categoryId);
      const bindingByCode = new Map(bindings.map((binding) => [binding.attribute.code, binding]));
      const specifications = item.specifications ?? {};
      const isPresent = (value: string | number | boolean | string[] | null | undefined) =>
        value !== null && value !== undefined && (typeof value !== 'string' || value.trim().length > 0) && (!Array.isArray(value) || value.length > 0);

      for (const binding of bindings) {
        if (binding.isRequired && !isPresent(specifications[binding.attribute.code])) {
          throw new BadRequestException(`ویژگی «${binding.attribute.nameFa}» برای این محصول الزامی است.`);
        }
      }

      for (const [code, value] of Object.entries(specifications)) {
        const binding = bindingByCode.get(code);
        if (!binding) throw new BadRequestException(`ویژگی فنی «${code}» برای دسته انتخاب‌شده معتبر نیست.`);
        if (!isPresent(value)) continue;

        const options = Array.isArray(binding.attribute.options)
          ? binding.attribute.options.filter((option): option is string => typeof option === 'string')
          : [];
        const validation = typeof binding.attribute.validation === 'object' && binding.attribute.validation !== null && !Array.isArray(binding.attribute.validation)
          ? binding.attribute.validation
          : {};

        if (binding.attribute.dataType === 'TEXT') {
          if (typeof value !== 'string') throw new BadRequestException(`مقدار «${binding.attribute.nameFa}» باید متن باشد.`);
          const maxLength = typeof validation.maxLength === 'number' ? validation.maxLength : undefined;
          if (maxLength && value.length > maxLength) throw new BadRequestException(`مقدار «${binding.attribute.nameFa}» بیش از حد طولانی است.`);
        }
        if (binding.attribute.dataType === 'NUMBER') {
          const numericValue = typeof value === 'number' ? value : (typeof value === 'string' ? Number(value) : Number.NaN);
          if (!Number.isFinite(numericValue)) throw new BadRequestException(`مقدار «${binding.attribute.nameFa}» باید عدد باشد.`);
          const minimum = typeof validation.min === 'number' ? validation.min : undefined;
          const maximum = typeof validation.max === 'number' ? validation.max : undefined;
          if (minimum !== undefined && numericValue < minimum) throw new BadRequestException(`مقدار «${binding.attribute.nameFa}» کمتر از حد مجاز است.`);
          if (maximum !== undefined && numericValue > maximum) throw new BadRequestException(`مقدار «${binding.attribute.nameFa}» بیشتر از حد مجاز است.`);
        }
        if (binding.attribute.dataType === 'SINGLE_SELECT' && (typeof value !== 'string' || !options.includes(value))) {
          throw new BadRequestException(`گزینه انتخاب‌شده برای «${binding.attribute.nameFa}» معتبر نیست.`);
        }
        if (binding.attribute.dataType === 'MULTI_SELECT' && (!Array.isArray(value) || value.some((selected) => !options.includes(selected)))) {
          throw new BadRequestException(`گزینه‌های انتخاب‌شده برای «${binding.attribute.nameFa}» معتبر نیست.`);
        }
        if (binding.attribute.dataType === 'BOOLEAN' && typeof value !== 'boolean') {
          throw new BadRequestException(`مقدار «${binding.attribute.nameFa}» باید بله یا خیر باشد.`);
        }
      }
    }
  }

  private async findAuthorizedRfq(user: AuthenticatedUser, rfqId: string) {
    const rfq = await this.prisma.rfq.findUnique({ where: { id: rfqId }, include: { items: true } });
    if (!rfq) throw new NotFoundException('استعلام پیدا نشد.');
    const isMember = user.memberships.some((membership) => membership.organizationId === rfq.buyerOrganizationId);
    const isOperator = user.permissions.includes('rfq.create_on_behalf') || user.permissions.includes('rfq.manage');
    if (!isMember && !isOperator) throw new NotFoundException('استعلام پیدا نشد.');
    return rfq;
  }

  private async runLifecycleWorker(): Promise<void> {
    if (this.lifecycleRunning) return;
    this.lifecycleRunning = true;
    try {
      const result = await this.processResponseDeadlines();
      if (result.negotiating + result.expired > 0) this.logger.log(`Closed ${result.negotiating + result.expired} RFQ response windows.`);
    }
    catch (error: unknown) {
      this.logger.error('RFQ lifecycle processing failed.', error instanceof Error ? error.stack : undefined);
    }
    finally { this.lifecycleRunning = false; }
  }
}
