import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../shared/prisma/prisma.service';
import type { AuthenticatedUser } from '../auth/auth.types';
import { resolvePaymentReconciliationStatus } from '../payments/payment-reconciliation-policy';
import { PaymentsService } from '../payments/payments.service';
import { CreateSubscriptionPlanDto } from './create-subscription-plan.dto';
import { ResolvePaymentReconciliationDto } from './resolve-payment-reconciliation.dto';
import { UpdateSubscriptionPlanDto } from './update-subscription-plan.dto';

@Injectable()
export class AdminBillingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly payments: PaymentsService,
    private readonly config: ConfigService,
  ) {}

  async overview(user: AuthenticatedUser) {
    this.requireAnyPermission(user, ['billing.read', 'billing.manage']);
    const [plans, subscriptions, payments, receipts, statusGroups, reminderGroups, reminders] = await Promise.all([
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
    ]);
    const payerIds = [...new Set(payments.map((payment) => payment.payerOrganizationId).filter((id): id is string => Boolean(id)))];
    const payers = payerIds.length
      ? await this.prisma.organization.findMany({ where: { id: { in: payerIds } }, select: { id: true, displayName: true, legalName: true } })
      : [];
    const payerMap = new Map(payers.map((payer) => [payer.id, payer]));
    return {
      summary: Object.fromEntries(statusGroups.map((item) => [item.status, item._count._all])),
      reminderSummary: Object.fromEntries(reminderGroups.map((item) => [`${item.channel}:${item.status}`, item._count._all])),
      reminderDelivery: this.reminderDeliveryReadiness(),
      plans,
      subscriptions,
      payments: payments.map((payment) => ({ ...payment, payerOrganization: payment.payerOrganizationId ? payerMap.get(payment.payerOrganizationId) ?? null : null })),
      receipts,
      reminders,
    };
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
    if (payment.provider !== 'ZARINPAL') throw new BadRequestException('تطبیق خودکار برای ارائه‌دهنده این تراکنش پشتیبانی نمی‌شود.');
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
    const serialized = JSON.stringify(value);
    if (serialized.length > 5_000) throw new BadRequestException('تنظیمات امکانات پلن بیش از حد بزرگ است.');
    return JSON.parse(serialized) as Prisma.InputJsonObject;
  }

  private reminderDeliveryReadiness() {
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
      deliveryWindow: '09:00-20:00 Asia/Tehran',
    };
  }

  private requireAnyPermission(user: AuthenticatedUser, permissions: string[]): void {
    if (!permissions.some((permission) => user.permissions.includes(permission))) {
      throw new ForbiddenException('شما مجوز مدیریت مالی و اشتراک‌ها را ندارید.');
    }
  }
}
