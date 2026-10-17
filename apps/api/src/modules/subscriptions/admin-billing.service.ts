import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../shared/prisma/prisma.service';
import type { AuthenticatedUser } from '../auth/auth.types';
import { resolvePaymentReconciliationStatus } from '../payments/payment-reconciliation-policy';
import { PaymentsService } from '../payments/payments.service';
import { CreateSubscriptionPlanDto } from './create-subscription-plan.dto';
import { CreateManualSubscriptionRenewalDto } from './create-manual-subscription-renewal.dto';
import { addBillingPeriod, buildRenewalReminderSchedule } from './subscription-policies';
import { ResolvePaymentReconciliationDto } from './resolve-payment-reconciliation.dto';
import { UpdateSubscriptionPlanDto } from './update-subscription-plan.dto';
import { buildBillingInvoiceNumber } from './billing-invoice-policy';
import { CreateSubscriptionDiscountDto } from './create-subscription-discount.dto';
import { UpdateSubscriptionDiscountStatusDto } from './update-subscription-discount-status.dto';
import { SubscriptionPolicySettingsService, type SubscriptionPolicySettings } from './subscription-policy-settings.service';

@Injectable()
export class AdminBillingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly payments: PaymentsService,
    private readonly config: ConfigService,
    private readonly policySettings: SubscriptionPolicySettingsService,
  ) {}

  async overview(user: AuthenticatedUser) {
    this.requireAnyPermission(user, ['billing.read', 'billing.manage']);
    const policy = await this.policySettings.get();
    const [plans, subscriptions, payments, receipts, statusGroups, reminderGroups, reminders, suppliers, manualRenewals, invoices, discountCodes, billingRequests] = await Promise.all([
      this.prisma.subscriptionPlan.findMany({ orderBy: [{ isActive: 'desc' }, { priceRial: 'asc' }] }),
      this.prisma.subscription.findMany({
        include: {
          plan: { select: { code: true, nameFa: true } },
          organization: { select: { id: true, displayName: true, legalName: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 100,
      }),
      this.prisma.paymentIntent.findMany({ orderBy: { createdAt: 'desc' }, take: 100 }),
      this.prisma.paymentReceipt.findMany({
        include: {
          organization: { select: { id: true, displayName: true, legalName: true } },
          paymentIntent: { select: { purpose: true, referenceType: true, referenceId: true } },
          subscription: { select: { plan: { select: { code: true, nameFa: true } } } },
          qualityControlRequest: { select: { rfq: { select: { code: true, title: true } } } },
        },
        orderBy: { paidAt: 'desc' },
        take: 100,
      }),
      this.prisma.subscription.groupBy({ by: ['status'], _count: { _all: true } }),
      this.prisma.subscriptionReminder.groupBy({ by: ['channel', 'status'], _count: { _all: true } }),
      this.prisma.subscriptionReminder.findMany({
        include: {
          subscription: {
            select: {
              organization: { select: { id: true, displayName: true, legalName: true } },
              plan: { select: { code: true, nameFa: true } },
            },
          },
        },
        orderBy: { scheduledAt: 'desc' },
        take: 100,
      }),
      this.prisma.organization.findMany({
        where: { kind: 'SUPPLIER', status: 'ACTIVE' },
        select: { id: true, displayName: true, legalName: true },
        orderBy: { displayName: 'asc' },
      }),
      this.prisma.manualSubscriptionRenewal.findMany({
        include: {
          organization: { select: { id: true, displayName: true, legalName: true } },
          subscription: { select: { startsAt: true, expiresAt: true, plan: { select: { code: true, nameFa: true } } } },
          activatedBy: { select: { firstName: true, lastName: true, mobile: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 100,
      }),
      this.prisma.billingInvoice.findMany({
        include: {
          organization: { select: { id: true, displayName: true, legalName: true } },
          subscription: { select: { plan: { select: { code: true, nameFa: true } } } },
          paymentIntent: { select: { providerReference: true } },
          manualRenewal: { select: { trackingNumber: true } },
        },
        orderBy: { issuedAt: 'desc' },
        take: 100,
      }),
      this.prisma.subscriptionDiscountCode.findMany({
        include: {
          applicablePlan: { select: { id: true, code: true, nameFa: true } },
          _count: { select: { redemptions: { where: { status: { in: ['RESERVED', 'REDEEMED'] } } } } },
        },
        orderBy: { createdAt: 'desc' },
        take: 100,
      }),
      this.prisma.supportTicket.findMany({
        where: {
          category: 'BILLING',
          status: { in: ['SUBMITTED', 'ACKNOWLEDGED', 'IN_REVIEW', 'WAITING_FOR_REQUESTER'] },
        },
        select: {
          id: true,
          code: true,
          type: true,
          priority: true,
          status: true,
          subject: true,
          description: true,
          createdAt: true,
          requester: { select: { firstName: true, lastName: true, mobile: true } },
          organization: { select: { id: true, displayName: true, legalName: true } },
          attachments: {
            where: { purpose: 'PAYMENT_RECEIPT', status: 'READY' },
            select: { id: true, originalName: true, sizeBytes: true, uploadedAt: true },
            orderBy: { createdAt: 'asc' },
          },
          _count: { select: { comments: true } },
        },
        orderBy: [{ priority: 'asc' }, { createdAt: 'asc' }],
        take: 100,
      }),
    ]);
    const payerIds = [...new Set(payments.map((payment) => payment.payerOrganizationId).filter((id): id is string => Boolean(id)))];
    const payers = payerIds.length
      ? await this.prisma.organization.findMany({ where: { id: { in: payerIds } }, select: { id: true, displayName: true, legalName: true } })
      : [];
    const commitmentRfqIds = receipts
      .filter((receipt) => receipt.paymentIntent.purpose === 'BUYER_COMMITMENT' && receipt.paymentIntent.referenceType === 'Rfq')
      .map((receipt) => receipt.paymentIntent.referenceId);
    const commitmentRfqs = commitmentRfqIds.length
      ? await this.prisma.rfq.findMany({ where: { id: { in: commitmentRfqIds } }, select: { id: true, code: true, title: true } })
      : [];
    const payerMap = new Map(payers.map((payer) => [payer.id, payer]));
    const commitmentRfqMap = new Map(commitmentRfqs.map((rfq) => [rfq.id, rfq]));
    return {
      summary: Object.fromEntries(statusGroups.map((item) => [item.status, item._count._all])),
      reminderSummary: Object.fromEntries(reminderGroups.map((item) => [`${item.channel}:${item.status}`, item._count._all])),
      reminderDelivery: this.reminderDeliveryReadiness(policy),
      plans,
      subscriptions,
      payments: payments.map((payment) => ({ ...payment, payerOrganization: payment.payerOrganizationId ? payerMap.get(payment.payerOrganizationId) ?? null : null })),
      receipts: receipts.map((receipt) => ({
        ...receipt,
        rfq: receipt.paymentIntent.purpose === 'BUYER_COMMITMENT'
          ? commitmentRfqMap.get(receipt.paymentIntent.referenceId) ?? null
          : null,
      })),
      reminders,
      suppliers,
      manualRenewals,
      invoices,
      discountCodes,
      billingRequests,
    };
  }

  async createDiscount(user: AuthenticatedUser, input: CreateSubscriptionDiscountDto) {
    this.requireAnyPermission(user, ['billing.manage']);
    const code = input.code.trim().toUpperCase();
    const validFrom = new Date(input.validFrom);
    const validUntil = new Date(input.validUntil);
    const minimumPurchaseRial = BigInt(input.minimumPurchaseRial);
    const fixedAmountRial = input.fixedAmountRial === undefined ? null : BigInt(input.fixedAmountRial);
    if (validUntil <= validFrom) throw new BadRequestException('زمان پایان اعتبار باید بعد از شروع اعتبار باشد.');
    if (minimumPurchaseRial < 0n) throw new BadRequestException('حداقل مبلغ خرید نمی‌تواند منفی باشد.');
    if (input.type === 'PERCENTAGE' && (input.percentageBps === undefined || fixedAmountRial !== null)) {
      throw new BadRequestException('برای تخفیف درصدی فقط درصد تخفیف را وارد کنید.');
    }
    if (input.type === 'FIXED_RIAL' && (fixedAmountRial === null || fixedAmountRial <= 0n || input.percentageBps !== undefined)) {
      throw new BadRequestException('برای تخفیف ثابت فقط مبلغ ریالی معتبر را وارد کنید.');
    }
    if (input.maxRedemptions !== undefined && input.maxRedemptions < input.perOrganizationLimit) {
      throw new BadRequestException('سقف کل استفاده نمی‌تواند کمتر از سقف هر سازمان باشد.');
    }
    if (input.applicablePlanId) {
      const plan = await this.prisma.subscriptionPlan.findUnique({ where: { id: input.applicablePlanId } });
      if (!plan || plan.isTrial) throw new NotFoundException('پلن پولی انتخاب‌شده پیدا نشد.');
    }
    try {
      return await this.prisma.$transaction(async (tx) => {
        const discount = await tx.subscriptionDiscountCode.create({ data: {
          code,
          nameFa: input.nameFa.trim(),
          descriptionFa: input.descriptionFa?.trim() || null,
          type: input.type,
          percentageBps: input.type === 'PERCENTAGE' ? input.percentageBps : null,
          fixedAmountRial: input.type === 'FIXED_RIAL' ? fixedAmountRial : null,
          applicablePlanId: input.applicablePlanId || null,
          minimumPurchaseRial,
          perOrganizationLimit: input.perOrganizationLimit,
          maxRedemptions: input.maxRedemptions ?? null,
          validFrom,
          validUntil,
          isActive: input.isActive,
        } });
        await tx.auditLog.create({ data: {
          actorUserId: user.id,
          action: 'subscription_discount.create',
          entityType: 'SubscriptionDiscountCode',
          entityId: discount.id,
          metadata: { code, type: input.type, applicablePlanId: input.applicablePlanId ?? null },
        } });
        return discount;
      });
    } catch (error: unknown) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('این کد تخفیف قبلاً ثبت شده است.');
      }
      throw error;
    }
  }

  async updateDiscountStatus(user: AuthenticatedUser, discountId: string, input: UpdateSubscriptionDiscountStatusDto) {
    this.requireAnyPermission(user, ['billing.manage']);
    return this.prisma.$transaction(async (tx) => {
      const discount = await tx.subscriptionDiscountCode.findUnique({ where: { id: discountId } });
      if (!discount) throw new NotFoundException('کد تخفیف پیدا نشد.');
      const updated = await tx.subscriptionDiscountCode.update({ where: { id: discount.id }, data: { isActive: input.isActive } });
      await tx.auditLog.create({ data: {
        actorUserId: user.id,
        action: input.isActive ? 'subscription_discount.activate' : 'subscription_discount.deactivate',
        entityType: 'SubscriptionDiscountCode',
        entityId: discount.id,
        metadata: { code: discount.code },
      } });
      return updated;
    });
  }

  async createManualRenewal(user: AuthenticatedUser, input: CreateManualSubscriptionRenewalDto) {
    this.requireAnyPermission(user, ['billing.manage']);
    const trackingNumber = input.trackingNumber.trim().toUpperCase();
    const note = input.note.trim();
    const policy = await this.policySettings.get();
    const amountRial = BigInt(input.amountRial);
    const paidAt = new Date(input.paidAt);
    if (amountRial <= 0n) throw new BadRequestException('مبلغ پرداخت دستی باید بیشتر از صفر باشد.');
    if (paidAt.getTime() > Date.now() + 5 * 60 * 1000) throw new BadRequestException('زمان پرداخت نمی‌تواند در آینده باشد.');

    const existing = await this.prisma.manualSubscriptionRenewal.findUnique({ where: { trackingNumber } });
    if (existing) throw new ConflictException('این شماره پیگیری قبلاً برای تمدید دستی ثبت شده است.');
    const [organization, plan, sourceTicket] = await Promise.all([
      this.prisma.organization.findUnique({ where: { id: input.organizationId } }),
      this.prisma.subscriptionPlan.findUnique({ where: { id: input.planId } }),
      input.sourceTicketId ? this.prisma.supportTicket.findUnique({ where: { id: input.sourceTicketId } }) : null,
    ]);
    if (!organization || organization.kind !== 'SUPPLIER' || organization.status !== 'ACTIVE') {
      throw new NotFoundException('سازمان فروشنده فعال پیدا نشد.');
    }
    if (!plan || !plan.isActive || plan.isTrial) throw new NotFoundException('پلن پولی فعال پیدا نشد.');
    if (input.sourceTicketId && (!sourceTicket || sourceTicket.category !== 'BILLING' || sourceTicket.organizationId !== organization.id)) {
      throw new NotFoundException('درخواست مالی مرتبط با این سازمان پیدا نشد.');
    }
    if (sourceTicket && !['SUBMITTED', 'ACKNOWLEDGED', 'IN_REVIEW', 'WAITING_FOR_REQUESTER'].includes(sourceTicket.status)) {
      throw new ConflictException('این درخواست مالی قبلاً بسته شده است.');
    }
    await this.assertFoundingProgramCapacity(organization.id, plan.id, plan.code, policy);

    try {
      return await this.prisma.$transaction(async (tx) => {
        const activatedAt = new Date();
        const current = await tx.subscription.findFirst({
          where: { organizationId: organization.id, status: { in: ['ACTIVE', 'GRACE'] }, expiresAt: { gt: activatedAt } },
          orderBy: { expiresAt: 'desc' },
        });
        const startsAt = current?.expiresAt ?? activatedAt;
        const expiresAt = addBillingPeriod(startsAt, plan.durationIso);
        const graceEndsAt = new Date(expiresAt.getTime() + policy.gracePeriodDays * 24 * 60 * 60 * 1000);
        const subscription = await tx.subscription.create({ data: {
          organizationId: organization.id,
          planId: plan.id,
          status: 'ACTIVE',
          startsAt,
          expiresAt,
          graceEndsAt,
          priceRialSnapshot: amountRial,
          listPriceRialSnapshot: amountRial,
          grantCreditSnapshot: plan.grantCredits,
          planVersionSnapshot: plan.version,
        } });
        const manualRenewal = await tx.manualSubscriptionRenewal.create({ data: {
          organizationId: organization.id,
          subscriptionId: subscription.id,
          activatedByUserId: user.id,
          trackingNumber,
          amountRial,
          paidAt,
          note,
        } });
        await tx.billingInvoice.create({ data: {
          invoiceNumber: buildBillingInvoiceNumber(subscription.id, activatedAt),
          organizationId: organization.id,
          purpose: 'SUBSCRIPTION',
          status: 'PAID',
          subscriptionId: subscription.id,
          manualRenewalId: manualRenewal.id,
          netAmountRial: amountRial,
          taxRial: 0n,
          totalAmountRial: amountRial,
          descriptionFa: `تمدید دستی اشتراک ${plan.nameFa}`,
          issuedAt: activatedAt,
          paidAt,
        } });
        const wallet = await tx.creditWallet.upsert({
          where: { organizationId: organization.id },
          create: { organizationId: organization.id, cachedBalanceCredits: plan.grantCredits },
          update: { cachedBalanceCredits: { increment: plan.grantCredits } },
        });
        await tx.creditLedgerEntry.create({ data: {
          walletId: wallet.id,
          type: 'GRANT',
          amountCredits: plan.grantCredits,
          referenceType: 'Subscription',
          referenceId: subscription.id,
          idempotencyKey: `subscription:${subscription.id}:grant:v1`,
          reasonCode: 'SUBSCRIPTION_MANUAL_RENEWAL',
          metadata: { trackingNumber },
        } });
        await tx.subscriptionReminder.updateMany({
          where: { subscription: { organizationId: organization.id }, status: 'PENDING' },
          data: { status: 'CANCELLED', cancelledAt: activatedAt },
        });
        await tx.subscriptionReminder.createMany({
          data: buildRenewalReminderSchedule(expiresAt, policy.renewalWarningOffsetsDays).flatMap(({ offsetDays, scheduledAt }) =>
            (['SMS', 'IN_APP'] as const).map((channel) => ({ subscriptionId: subscription.id, offsetDays, scheduledAt, channel }))),
          skipDuplicates: true,
        });
        if (sourceTicket) {
          const resolvedTicket = await tx.supportTicket.updateMany({
            where: {
              id: sourceTicket.id,
              status: { in: ['SUBMITTED', 'ACKNOWLEDGED', 'IN_REVIEW', 'WAITING_FOR_REQUESTER'] },
            },
            data: {
              status: 'RESOLVED',
              resolution: `تمدید دستی با شماره پیگیری ${trackingNumber} ثبت و اشتراک فعال شد.`,
              resolvedAt: activatedAt,
            },
          });
          if (resolvedTicket.count !== 1) throw new ConflictException('وضعیت درخواست مالی هم‌زمان تغییر کرده است؛ دوباره بررسی کنید.');
          await tx.auditLog.create({ data: {
            actorUserId: user.id,
            organizationId: organization.id,
            action: 'support_ticket.status.update',
            entityType: 'SupportTicket',
            entityId: sourceTicket.id,
            metadata: { from: sourceTicket.status, to: 'RESOLVED', source: 'MANUAL_SUBSCRIPTION_RENEWAL', trackingNumber },
          } });
          await tx.outboxEvent.create({ data: {
            aggregateType: 'SupportTicket',
            aggregateId: sourceTicket.id,
            eventType: 'ir.vazano.support.ticket.status_changed.v1',
            payload: { ticketId: sourceTicket.id, from: sourceTicket.status, to: 'RESOLVED' },
          } });
        }
        await tx.auditLog.create({ data: {
          actorUserId: user.id,
          organizationId: organization.id,
          action: 'subscription.manual_renewal.create',
          entityType: 'ManualSubscriptionRenewal',
          entityId: manualRenewal.id,
          metadata: { subscriptionId: subscription.id, planCode: plan.code, trackingNumber, amountRial: amountRial.toString(), paidAt: paidAt.toISOString(), note, sourceTicketId: sourceTicket?.id ?? null },
        } });
        await tx.outboxEvent.create({ data: {
          aggregateType: 'Subscription',
          aggregateId: subscription.id,
          eventType: 'ir.vazano.subscription.activated.v1',
          payload: { subscriptionId: subscription.id, organizationId: organization.id, activationSource: 'MANUAL_RENEWAL', trackingNumber, expiresAt: expiresAt.toISOString(), sourceTicketId: sourceTicket?.id ?? null },
        } });
        return { manualRenewal, subscription };
      });
    } catch (error: unknown) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('این شماره پیگیری قبلاً برای تمدید دستی ثبت شده است.');
      }
      throw error;
    }
  }

  async createPlan(user: AuthenticatedUser, input: CreateSubscriptionPlanDto) {
    this.requireAnyPermission(user, ['billing.manage']);
    this.validatePlanAmountsAndLimits(input.priceRial, input.grantCredits, input.dailyProposalLimit, input.maxProposalLimit, input.isTrial);
    this.validateTrialPlan(input.isTrial, input.billingCycle, input.durationIso, input.taxIncluded);
    const entitlements = this.normalizeEntitlements(input.entitlements);
    try {
      return await this.prisma.$transaction(async (tx) => {
        const plan = await tx.subscriptionPlan.create({
          data: {
            code: input.code.trim(),
            nameFa: input.nameFa.trim(),
            descriptionFa: input.descriptionFa?.trim() || null,
            billingCycle: input.billingCycle,
            durationIso: input.durationIso,
            priceRial: BigInt(input.priceRial),
            grantCredits: BigInt(input.grantCredits),
            dailyProposalLimit: input.dailyProposalLimit,
            maxProposalLimit: input.maxProposalLimit,
            taxIncluded: input.taxIncluded,
            isTrial: input.isTrial,
            isPublic: input.isPublic,
            isActive: input.isActive,
            entitlements,
          },
        });
        await tx.auditLog.create({ data: {
          actorUserId: user.id,
          action: 'subscription_plan.create',
          entityType: 'SubscriptionPlan',
          entityId: plan.id,
          metadata: { code: plan.code, priceRial: plan.priceRial.toString(), version: plan.version },
        } });
        return plan;
      });
    } catch (error: unknown) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') throw new ConflictException('کد این پلن قبلاً ثبت شده است.');
      throw error;
    }
  }

  async updatePlan(user: AuthenticatedUser, planId: string, input: UpdateSubscriptionPlanDto) {
    this.requireAnyPermission(user, ['billing.manage']);
    const entitlements = this.normalizeEntitlements(input.entitlements);
    const plan = await this.prisma.subscriptionPlan.findUnique({ where: { id: planId } });
    if (!plan) throw new NotFoundException('پلن اشتراک پیدا نشد.');
    this.validatePlanAmountsAndLimits(input.priceRial, input.grantCredits, input.dailyProposalLimit, input.maxProposalLimit, plan.isTrial);

    return this.prisma.$transaction(async (tx) => {
      const result = await tx.subscriptionPlan.updateMany({
        where: { id: plan.id, version: input.expectedVersion },
        data: {
          nameFa: input.nameFa.trim(),
          descriptionFa: input.descriptionFa?.trim() || null,
          priceRial: BigInt(input.priceRial),
          grantCredits: BigInt(input.grantCredits),
          dailyProposalLimit: input.dailyProposalLimit,
          maxProposalLimit: input.maxProposalLimit,
          taxIncluded: input.taxIncluded,
          isPublic: input.isPublic,
          isActive: input.isActive,
          entitlements,
          version: { increment: 1 },
        },
      });
      if (result.count !== 1) throw new ConflictException('این پلن هم‌زمان تغییر کرده است؛ اطلاعات را دوباره بارگذاری کنید.');
      await tx.auditLog.create({ data: {
        actorUserId: user.id,
        action: 'subscription_plan.update',
        entityType: 'SubscriptionPlan',
        entityId: plan.id,
        metadata: {
          code: plan.code,
          previousPriceRial: plan.priceRial.toString(),
          newPriceRial: input.priceRial,
          previousVersion: plan.version,
        },
      } });
      return tx.subscriptionPlan.findUniqueOrThrow({ where: { id: plan.id } });
    });
  }

  async reconcilePayment(user: AuthenticatedUser, paymentId: string) {
    this.requireAnyPermission(user, ['billing.manage']);
    const payment = await this.prisma.paymentIntent.findUnique({ where: { id: paymentId } });
    if (!payment) throw new NotFoundException('تراکنش پرداخت پیدا نشد.');
    if (payment.provider !== this.payments.provider) throw new BadRequestException('تطبیق خودکار برای ارائه‌دهنده این تراکنش پشتیبانی نمی‌شود.');
    if (!payment.authority) throw new ConflictException('شناسه مرجع درگاه برای این تراکنش ثبت نشده است.');

    const verification = await this.payments.verify({ amountRial: payment.amountRial, authority: payment.authority });
    const reconciliationStatus = resolvePaymentReconciliationStatus(payment.status, verification.success);
    const reconciledAt = new Date();
    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.paymentIntent.update({
        where: { id: payment.id },
        data: {
          reconciliationStatus,
          lastReconciledAt: reconciledAt,
          lastProviderCode: verification.code,
          reconciliationResolution: null,
          reconciliationResolutionNote: null,
          reconciliationResolvedAt: null,
          reconciliationResolvedByUserId: null,
        },
      });
      await tx.auditLog.create({ data: {
        actorUserId: user.id,
        organizationId: payment.payerOrganizationId,
        action: 'payment.reconcile',
        entityType: 'PaymentIntent',
        entityId: payment.id,
        metadata: {
          localStatus: payment.status,
          providerSuccess: verification.success,
          providerCode: verification.code,
          providerReference: verification.referenceId ?? null,
          reconciliationStatus,
        },
      } });
      return result;
    });
    return {
      payment: updated,
      provider: { success: verification.success, code: verification.code, referenceId: verification.referenceId ?? null },
    };
  }

  async resolvePaymentReconciliation(user: AuthenticatedUser, paymentId: string, input: ResolvePaymentReconciliationDto) {
    this.requireAnyPermission(user, ['billing.manage']);
    const payment = await this.prisma.paymentIntent.findUnique({ where: { id: paymentId } });
    if (!payment) throw new NotFoundException('تراکنش پرداخت پیدا نشد.');
    if (!['ACTION_REQUIRED', 'PROVIDER_UNCONFIRMED'].includes(payment.reconciliationStatus)) {
      throw new ConflictException('این تراکنش در صف رسیدگی مالی قرار ندارد.');
    }
    if (payment.reconciliationResolvedAt) throw new ConflictException('رسیدگی این تراکنش قبلاً ثبت شده است.');

    const note = input.note.trim();
    if (note.length < 10) throw new BadRequestException('توضیح رسیدگی باید حداقل ۱۰ نویسه مفید داشته باشد.');
    return this.prisma.$transaction(async (tx) => {
      const result = await tx.paymentIntent.updateMany({
        where: { id: payment.id, reconciliationResolvedAt: null, reconciliationStatus: payment.reconciliationStatus },
        data: {
          reconciliationResolution: input.resolution,
          reconciliationResolutionNote: note,
          reconciliationResolvedAt: new Date(),
          reconciliationResolvedByUserId: user.id,
        },
      });
      if (result.count !== 1) throw new ConflictException('وضعیت تراکنش هم‌زمان تغییر کرده است؛ اطلاعات را دوباره بارگذاری کنید.');
      await tx.auditLog.create({ data: {
        actorUserId: user.id,
        organizationId: payment.payerOrganizationId,
        action: 'payment.reconciliation.resolve',
        entityType: 'PaymentIntent',
        entityId: payment.id,
        metadata: {
          localStatus: payment.status,
          reconciliationStatus: payment.reconciliationStatus,
          resolution: input.resolution,
          note,
        },
      } });
      if (input.resolution === 'CUSTOMER_RETRY_REQUIRED') {
        await tx.outboxEvent.create({ data: {
          aggregateType: 'PaymentIntent',
          aggregateId: payment.id,
          eventType: 'ir.vazano.payment.retry_requested.v1',
          payload: {
            paymentId: payment.id,
            payerOrganizationId: payment.payerOrganizationId,
            purpose: payment.purpose,
          },
        } });
      }
      return tx.paymentIntent.findUniqueOrThrow({ where: { id: payment.id } });
    });
  }

  async retryReminder(user: AuthenticatedUser, reminderId: string) {
    this.requireAnyPermission(user, ['billing.manage']);
    const reminder = await this.prisma.subscriptionReminder.findUnique({
      where: { id: reminderId },
      select: { id: true, channel: true, status: true, subscription: { select: { organizationId: true } } },
    });
    if (!reminder) throw new NotFoundException('اخطار تمدید پیدا نشد.');
    if (reminder.channel !== 'SMS' || reminder.status !== 'FAILED') {
      throw new ConflictException('فقط پیامک ناموفق را می‌توان دوباره در صف قرار داد.');
    }

    return this.prisma.$transaction(async (tx) => {
      const result = await tx.subscriptionReminder.updateMany({
        where: { id: reminder.id, channel: 'SMS', status: 'FAILED' },
        data: { status: 'PENDING', sentAt: null, cancelledAt: null, failureReason: null },
      });
      if (result.count !== 1) throw new ConflictException('وضعیت اخطار هم‌زمان تغییر کرده است؛ صفحه را دوباره بارگذاری کنید.');
      await tx.auditLog.create({ data: {
        actorUserId: user.id,
        organizationId: reminder.subscription.organizationId,
        action: 'subscription.reminder.sms.requeued',
        entityType: 'SubscriptionReminder',
        entityId: reminder.id,
      } });
      return tx.subscriptionReminder.findUniqueOrThrow({ where: { id: reminder.id } });
    });
  }

  private validatePlanAmountsAndLimits(priceRial: string, grantCredits: string, dailyLimit: number, maxLimit: number, isTrial: boolean): void {
    if (isTrial && BigInt(priceRial) !== 0n) throw new BadRequestException('مبلغ پلن آزمایشی باید صفر باشد.');
    if (!isTrial && BigInt(priceRial) <= 0n) throw new BadRequestException('مبلغ پلن پولی باید بیشتر از صفر باشد.');
    if (BigInt(grantCredits) < 0n) throw new BadRequestException('اعتبار پلن نمی‌تواند منفی باشد.');
    if (maxLimit < dailyLimit) throw new BadRequestException('سقف افزایش‌یافته نمی‌تواند کمتر از سقف پایه روزانه باشد.');
  }

  private validateTrialPlan(isTrial: boolean, billingCycle: string, durationIso: string, taxIncluded: boolean): void {
    if (isTrial && (billingCycle !== 'CUSTOM' || !/^P(?:[1-9]|[1-8][0-9]|90)D$/.test(durationIso))) {
      throw new BadRequestException('مدت پلن آزمایشی باید بین ۱ تا ۹۰ روز باشد.');
    }
    if (isTrial && taxIncluded) throw new BadRequestException('پلن رایگان آزمایشی نمی‌تواند شامل مالیات باشد.');
    if (!isTrial && /^P\d+D$/.test(durationIso)) throw new BadRequestException('دوره روزانه فقط برای پلن آزمایشی مجاز است.');
  }

  private normalizeEntitlements(value: Record<string, unknown>): Prisma.InputJsonObject {
    const totalProposalLimit = value.totalProposalLimit;
    if (totalProposalLimit !== undefined && totalProposalLimit !== null
      && (!Number.isInteger(totalProposalLimit) || (totalProposalLimit as number) < 0 || (totalProposalLimit as number) > 100_000)) {
      throw new BadRequestException('سقف کل پیشنهادهای پلن باید عددی صحیح بین صفر تا ۱۰۰٬۰۰۰ باشد.');
    }
    const serialized = JSON.stringify(value);
    if (serialized.length > 5_000) throw new BadRequestException('تنظیمات امکانات پلن بیش از حد بزرگ است.');
    return JSON.parse(serialized) as Prisma.InputJsonObject;
  }

  private async assertFoundingProgramCapacity(
    organizationId: string,
    planId: string,
    planCode: string,
    policy: SubscriptionPolicySettings,
  ): Promise<void> {
    const founding = policy.foundingProgram;
    if (planCode !== founding.planCode) return;
    if (!founding.enabled) throw new ConflictException('برنامه کارخانه‌های مؤسس در حال حاضر غیرفعال است.');
    const enrolledOrganizations = await this.prisma.subscription.findMany({
      where: { planId },
      distinct: ['organizationId'],
      select: { organizationId: true },
    });
    if (!enrolledOrganizations.some((item) => item.organizationId === organizationId)
      && enrolledOrganizations.length >= founding.capacity) {
      throw new ConflictException('ظرفیت برنامه کارخانه‌های مؤسس تکمیل شده است.');
    }
  }

  private reminderDeliveryReadiness(policy: SubscriptionPolicySettings) {
    const templateKeys = [
      'SMSIR_SUBSCRIPTION_RENEWAL_14_TEMPLATE_ID',
      'SMSIR_SUBSCRIPTION_RENEWAL_7_TEMPLATE_ID',
      'SMSIR_SUBSCRIPTION_RENEWAL_3_TEMPLATE_ID',
      'SMSIR_SUBSCRIPTION_EXPIRED_TEMPLATE_ID',
      'SMSIR_SUBSCRIPTION_GRACE_ENDED_TEMPLATE_ID',
      'SMSIR_SUBSCRIPTION_TRIAL_7_TEMPLATE_ID',
      'SMSIR_SUBSCRIPTION_TRIAL_3_TEMPLATE_ID',
      'SMSIR_SUBSCRIPTION_TRIAL_1_TEMPLATE_ID',
      'SMSIR_SUBSCRIPTION_TRIAL_ENDED_TEMPLATE_ID',
    ] as const;
    const enabled = this.config.get<string>('SUBSCRIPTION_SMS_ENABLED', 'false') === 'true';
    const provider = this.config.get<string>('SMS_PROVIDER', 'debug');
    const templatesConfigured = templateKeys.every((key) => {
      const value = Number(this.config.get<string>(key));
      return Number.isInteger(value) && value > 0;
    });
    return {
      enabled,
      provider: provider === 'smsir' ? 'SMSIR' : 'DEBUG',
      templatesConfigured,
      liveReady: enabled && provider === 'smsir' && templatesConfigured,
      deliveryWindow: `${String(policy.sms.startHour).padStart(2, '0')}:00-${String(policy.sms.endHour).padStart(2, '0')}:00 ${policy.sms.timezone}`,
    };
  }

  private requireAnyPermission(user: AuthenticatedUser, permissions: string[]): void {
    if (!permissions.some((permission) => user.permissions.includes(permission))) {
      throw new ForbiddenException('شما مجوز مدیریت مالی و اشتراک‌ها را ندارید.');
    }
  }
}
