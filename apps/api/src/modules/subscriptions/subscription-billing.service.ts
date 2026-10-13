import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, type SubscriptionPlan } from '@prisma/client';
import type { AuthenticatedUser } from '../auth/auth.types';
import { PaymentsService } from '../payments/payments.service';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { addBillingPeriod, buildRenewalReminderSchedule, buildTrialReminderSchedule } from './subscription-policies';
import { buildPaymentReceiptSnapshot } from './payment-receipt-policy';
import { buildBillingInvoiceNumber } from './billing-invoice-policy';
import { calculateSubscriptionDiscount } from './subscription-discount-policy';
import { SubscriptionPolicySettingsService } from './subscription-policy-settings.service';

@Injectable()
export class SubscriptionBillingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly payments: PaymentsService,
    private readonly config: ConfigService,
    private readonly policySettings: SubscriptionPolicySettingsService,
  ) {}

  async previewDiscount(user: AuthenticatedUser, organizationId: string, planId: string, discountCode: string) {
    const membership = user.memberships.find((item) => item.organizationId === organizationId);
    const canManage = membership?.role === 'SUPPLIER_OWNER' || user.permissions.includes('subscription.manage');
    if (!canManage) throw new ForbiddenException('مجوز خرید اشتراک برای این سازمان را ندارید.');
    const [organization, plan] = await Promise.all([
      this.prisma.organization.findUnique({ where: { id: organizationId } }),
      this.prisma.subscriptionPlan.findFirst({ where: { id: planId, isActive: true, isPublic: true } }),
    ]);
    if (!organization || organization.kind !== 'SUPPLIER' || organization.status !== 'ACTIVE') throw new NotFoundException('سازمان فروشنده فعال پیدا نشد.');
    if (!plan || plan.isTrial) throw new NotFoundException('پلن پولی معتبر پیدا نشد.');
    await this.assertCustomerPurchasablePlan(plan.code);
    const discount = await this.prisma.$transaction((tx) => this.resolveDiscount(tx, discountCode.trim().toUpperCase(), organizationId, plan));
    return {
      code: discount.code,
      listPriceRial: plan.priceRial,
      discountRial: discount.amountRial,
      payableRial: plan.priceRial - discount.amountRial,
    };
  }

  async startCheckout(user: AuthenticatedUser, organizationId: string, planId: string, idempotencyKey: string, discountCode?: string) {
    const membership = user.memberships.find((item) => item.organizationId === organizationId);
    const canManage = membership?.role === 'SUPPLIER_OWNER' || user.permissions.includes('subscription.manage');
    if (!canManage) throw new ForbiddenException('مجوز خرید اشتراک برای این سازمان را ندارید.');
    const [organization, plan] = await Promise.all([
      this.prisma.organization.findUnique({ where: { id: organizationId } }),
      this.prisma.subscriptionPlan.findFirst({ where: { id: planId, isActive: true, isPublic: true } }),
    ]);
    if (!organization || organization.kind !== 'SUPPLIER') throw new NotFoundException('سازمان فروشنده پیدا نشد.');
    if (organization.status !== 'ACTIVE') throw new ConflictException('خرید اشتراک پس از تأیید فروشنده فعال می‌شود.');
    if (!plan) throw new NotFoundException('پلن اشتراک معتبر نیست.');
    await this.assertCustomerPurchasablePlan(plan.code);
    const normalizedDiscountCode = discountCode?.trim().toUpperCase() || null;
    const [existingIntent, existingTrialRequest] = await Promise.all([
      this.prisma.paymentIntent.findUnique({ where: { idempotencyKey } }),
      this.prisma.subscription.findUnique({ where: { trialActivationKey: idempotencyKey } }),
    ]);
    if (plan.isTrial) {
      if (normalizedDiscountCode) throw new ConflictException('کد تخفیف برای پلن آزمایشی قابل استفاده نیست.');
      if (existingIntent) throw new ConflictException('کلید تکرارپذیری برای یک پرداخت استفاده شده است.');
      if (existingTrialRequest && (existingTrialRequest.organizationId !== organizationId || existingTrialRequest.planId !== plan.id || !existingTrialRequest.isTrialSnapshot)) {
        throw new ConflictException('کلید تکرارپذیری برای درخواست دیگری استفاده شده است.');
      }
      return this.activateTrial(user, organizationId, plan, idempotencyKey);
    }
    if (existingTrialRequest) throw new ConflictException('کلید تکرارپذیری برای یک دوره آزمایشی استفاده شده است.');

    let subscription = existingIntent
      ? await this.prisma.subscription.findUniqueOrThrow({ where: { id: existingIntent.referenceId } })
      : null;
    if (existingIntent && (
      existingIntent.purpose !== 'SUBSCRIPTION'
      || existingIntent.payerOrganizationId !== organizationId
      || existingIntent.amountRial !== subscription?.priceRialSnapshot
      || subscription.planId !== plan.id
      || subscription.discountCodeSnapshot !== normalizedDiscountCode
    )) throw new ConflictException('کلید تکرارپذیری برای درخواست دیگری استفاده شده است.');
    if (existingIntent && ['FAILED', 'CANCELLED'].includes(existingIntent.status)) {
      throw new ConflictException('این تلاش پرداخت بسته شده است؛ برای پرداخت مجدد یک درخواست تازه ایجاد کنید.');
    }
    if (existingIntent?.authority && ['REDIRECT_PENDING', 'VERIFY_PENDING', 'SUCCEEDED'].includes(existingIntent.status)) {
      const callbackUrl = `${this.publicApiUrl()}/v1/subscriptions/zarinpal/callback`;
      return { paymentIntentId: existingIntent.id, subscriptionId: existingIntent.referenceId, authority: existingIntent.authority, redirectUrl: this.payments.redirectUrl(existingIntent.authority, callbackUrl) };
    }

    let intent = existingIntent;
    if (!subscription || !intent) {
      try {
        const created = await this.prisma.$transaction(async (tx) => {
          const discount = normalizedDiscountCode
            ? await this.resolveDiscount(tx, normalizedDiscountCode, organizationId, plan)
            : null;
          const discountRial = discount?.amountRial ?? 0n;
          const createdSubscription = await tx.subscription.create({ data: {
            organizationId,
            planId: plan.id,
            priceRialSnapshot: plan.priceRial - discountRial,
            listPriceRialSnapshot: plan.priceRial,
            discountRialSnapshot: discountRial,
            discountCodeSnapshot: discount?.code ?? null,
            grantCreditSnapshot: plan.grantCredits,
            planVersionSnapshot: plan.version,
          } });
          if (discount) {
            await tx.subscriptionDiscountRedemption.create({ data: {
              discountCodeId: discount.id,
              organizationId,
              subscriptionId: createdSubscription.id,
              discountAmountRial: discount.amountRial,
            } });
          }
          const createdIntent = await tx.paymentIntent.create({ data: {
            provider: this.payments.provider,
            purpose: 'SUBSCRIPTION',
            amountRial: createdSubscription.priceRialSnapshot,
            payerOrganizationId: organizationId,
            referenceType: 'Subscription',
            referenceId: createdSubscription.id,
            idempotencyKey,
          } });
          return { subscription: createdSubscription, intent: createdIntent };
        }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
        subscription = created.subscription;
        intent = created.intent;
      } catch (error: unknown) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && ['P2002', 'P2034'].includes(error.code)) {
          throw new ConflictException('ظرفیت کد تخفیف یا وضعیت درخواست هم‌زمان تغییر کرده است؛ دوباره تلاش کنید.');
        }
        throw error;
      }
    }
    if (subscription.planId !== plan.id || subscription.organizationId !== organizationId) {
      throw new ConflictException('درخواست پرداخت با پلن انتخابی سازگار نیست.');
    }
    const issuedAt = new Date();
    await this.prisma.billingInvoice.upsert({
      where: { subscriptionId: subscription.id },
      create: {
        invoiceNumber: buildBillingInvoiceNumber(subscription.id, issuedAt),
        organizationId,
        purpose: 'SUBSCRIPTION',
        subscriptionId: subscription.id,
        paymentIntentId: intent.id,
        netAmountRial: intent.amountRial,
        taxRial: 0n,
        totalAmountRial: intent.amountRial,
        descriptionFa: subscription.discountCodeSnapshot ? `اشتراک ${plan.nameFa} با کد تخفیف ${subscription.discountCodeSnapshot}` : `اشتراک ${plan.nameFa}`,
        issuedAt,
        dueAt: new Date(issuedAt.getTime() + 24 * 60 * 60 * 1000),
      },
      update: { paymentIntentId: intent.id, status: 'ISSUED', dueAt: new Date(issuedAt.getTime() + 24 * 60 * 60 * 1000) },
    });
    try {
      const result = await this.payments.create({ amountRial: intent.amountRial, description: `خرید ${plan.nameFa}`, callbackUrl: `${this.publicApiUrl()}/v1/subscriptions/zarinpal/callback`, mobile: user.mobile, orderId: subscription.id });
      await this.prisma.paymentIntent.update({ where: { id: intent.id }, data: { authority: result.authority, status: 'REDIRECT_PENDING' } });
      return { paymentIntentId: intent.id, subscriptionId: subscription.id, ...result };
    } catch (error) {
      await this.closeUnsuccessfulPayment(intent.id, intent.referenceId, 'FAILED', { stage: 'CREATE_PAYMENT_REQUEST' });
      throw error;
    }
  }

  async handleCallback(authority: string, callbackStatus: 'OK' | 'NOK') {
    const intent = await this.prisma.paymentIntent.findFirst({ where: { authority, provider: this.payments.provider, purpose: 'SUBSCRIPTION' } });
    if (!intent) throw new NotFoundException('تراکنش اشتراک پیدا نشد.');
    if (intent.status === 'SUCCEEDED') return { success: true, alreadyVerified: true, referenceId: intent.providerReference };
    if (intent.status === 'CANCELLED') return { success: false, cancelled: true };
    if (intent.status === 'FAILED') return { success: false, failed: true };
    if (intent.status !== 'REDIRECT_PENDING') return { success: false, processing: intent.status === 'VERIFY_PENDING' };
    if (callbackStatus !== 'OK') {
      await this.closeUnsuccessfulPayment(intent.id, intent.referenceId, 'CANCELLED', { status: callbackStatus });
      return { success: false, cancelled: true };
    }
    const verification = await this.payments.verify({ amountRial: intent.amountRial, authority });
    if (!verification.success) {
      await this.closeUnsuccessfulPayment(intent.id, intent.referenceId, 'FAILED', { status: callbackStatus, code: verification.code });
      return verification;
    }

    const policy = await this.policySettings.get();

    return this.prisma.$transaction(async (tx) => {
      const claim = await tx.paymentIntent.updateMany({
        where: { id: intent.id, status: 'REDIRECT_PENDING' },
        data: { status: 'VERIFY_PENDING' },
      });
      if (claim.count === 0) {
        const completed = await tx.paymentIntent.findUniqueOrThrow({ where: { id: intent.id } });
        if (completed.status === 'SUCCEEDED') {
          return { success: true, alreadyVerified: true, referenceId: completed.providerReference };
        }
        return {
          success: false,
          cancelled: completed.status === 'CANCELLED',
          failed: completed.status === 'FAILED',
          processing: completed.status === 'VERIFY_PENDING',
        };
      }

      const subscription = await tx.subscription.findUnique({ where: { id: intent.referenceId }, include: { plan: true } });
      if (!subscription) throw new NotFoundException('اشتراک مرتبط با پرداخت پیدا نشد.');
      const paidAt = new Date();
      const current = await tx.subscription.findFirst({
        where: { organizationId: subscription.organizationId, status: { in: ['ACTIVE', 'GRACE'] }, expiresAt: { gt: paidAt }, id: { not: subscription.id } },
        orderBy: { expiresAt: 'desc' },
      });
      const startsAt = current?.expiresAt ?? paidAt;
      const expiresAt = addBillingPeriod(startsAt, subscription.plan.durationIso);
      const graceEndsAt = new Date(expiresAt.getTime() + policy.gracePeriodDays * 24 * 60 * 60 * 1000);
      const schedule = buildRenewalReminderSchedule(expiresAt, policy.renewalWarningOffsetsDays);
      const receipt = buildPaymentReceiptSnapshot(intent.id, intent.amountRial, paidAt);

      const wallet = await tx.creditWallet.upsert({
        where: { organizationId: subscription.organizationId },
        create: { organizationId: subscription.organizationId, cachedBalanceCredits: subscription.grantCreditSnapshot },
        update: { cachedBalanceCredits: { increment: subscription.grantCreditSnapshot } },
      });
      await tx.creditLedgerEntry.create({
        data: { walletId: wallet.id, type: 'GRANT', amountCredits: subscription.grantCreditSnapshot, referenceType: 'Subscription', referenceId: subscription.id, idempotencyKey: `subscription:${subscription.id}:grant:v1`, reasonCode: 'SUBSCRIPTION_PAYMENT_VERIFIED' },
      });
      await tx.subscription.update({ where: { id: subscription.id }, data: { status: 'ACTIVE', startsAt, expiresAt, graceEndsAt } });
      await tx.subscriptionDiscountRedemption.updateMany({
        where: { subscriptionId: subscription.id, status: 'RESERVED' },
        data: { status: 'REDEEMED', redeemedAt: paidAt },
      });
      await tx.subscriptionReminder.updateMany({ where: { subscription: { organizationId: subscription.organizationId }, status: 'PENDING' }, data: { status: 'CANCELLED', cancelledAt: new Date() } });
      await tx.subscriptionReminder.createMany({
        data: schedule.flatMap(({ offsetDays, scheduledAt }) => (['SMS', 'IN_APP'] as const).map((channel) => ({ subscriptionId: subscription.id, offsetDays, scheduledAt, channel }))),
        skipDuplicates: true,
      });
      await tx.paymentReceipt.create({ data: {
        ...receipt,
        organizationId: subscription.organizationId,
        subscriptionId: subscription.id,
        paymentIntentId: intent.id,
        providerReference: verification.referenceId,
      } });
      await tx.billingInvoice.upsert({
        where: { subscriptionId: subscription.id },
        create: {
          invoiceNumber: buildBillingInvoiceNumber(subscription.id, paidAt),
          organizationId: subscription.organizationId,
          purpose: 'SUBSCRIPTION',
          status: 'PAID',
          subscriptionId: subscription.id,
          paymentIntentId: intent.id,
          netAmountRial: intent.amountRial,
          taxRial: 0n,
          totalAmountRial: intent.amountRial,
          descriptionFa: `اشتراک ${subscription.plan.nameFa}`,
          issuedAt: paidAt,
          paidAt,
        },
        update: { status: 'PAID', paymentIntentId: intent.id, paidAt },
      });
      await tx.paymentIntent.update({ where: { id: intent.id }, data: { status: 'SUCCEEDED', providerReference: verification.referenceId, verifiedAt: paidAt, callbackPayload: { status: callbackStatus, code: verification.code } } });
      await tx.auditLog.create({ data: { organizationId: subscription.organizationId, action: 'subscription.activate', entityType: 'Subscription', entityId: subscription.id, metadata: { paymentIntentId: intent.id, planCode: subscription.plan.code } } });
      await tx.outboxEvent.create({ data: { aggregateType: 'Subscription', aggregateId: subscription.id, eventType: 'ir.vazano.subscription.activated.v1', payload: { subscriptionId: subscription.id, organizationId: subscription.organizationId, receiptNumber: receipt.receiptNumber } } });
      return { ...verification, receiptNumber: receipt.receiptNumber };
    });
  }

  private publicApiUrl(): string {
    return (this.config.get<string>('PUBLIC_API_URL') ?? 'http://localhost:3001').replace(/\/$/, '');
  }

  private async closeUnsuccessfulPayment(
    paymentIntentId: string,
    subscriptionId: string,
    status: 'FAILED' | 'CANCELLED',
    callbackPayload: Prisma.InputJsonObject,
  ): Promise<void> {
    const closedAt = new Date();
    await this.prisma.$transaction(async (tx) => {
      const claim = await tx.paymentIntent.updateMany({
        where: { id: paymentIntentId, status: { in: ['CREATED', 'REDIRECT_PENDING', 'VERIFY_PENDING'] } },
        data: { status, callbackPayload },
      });
      if (claim.count !== 1) return;
      await tx.subscription.updateMany({ where: { id: subscriptionId, status: 'DRAFT' }, data: { status: 'CANCELLED' } });
      await tx.billingInvoice.updateMany({
        where: { paymentIntentId, status: { in: ['ISSUED', 'OVERDUE'] } },
        data: { status: 'CANCELLED' },
      });
      await tx.subscriptionDiscountRedemption.updateMany({
        where: { subscriptionId, status: 'RESERVED' },
        data: { status: 'CANCELLED', cancelledAt: closedAt },
      });
      await tx.auditLog.create({ data: {
        organizationId: (await tx.subscription.findUniqueOrThrow({ where: { id: subscriptionId }, select: { organizationId: true } })).organizationId,
        action: status === 'FAILED' ? 'subscription.payment.failed' : 'subscription.payment.cancelled',
        entityType: 'PaymentIntent',
        entityId: paymentIntentId,
        metadata: callbackPayload,
      } });
      await tx.outboxEvent.create({ data: {
        aggregateType: 'PaymentIntent',
        aggregateId: paymentIntentId,
        eventType: 'ir.vazano.payment.retry_requested.v1',
        payload: { paymentId: paymentIntentId, subscriptionId, status },
      } });
    });
  }

  private async resolveDiscount(tx: Prisma.TransactionClient, code: string, organizationId: string, plan: SubscriptionPlan) {
    const now = new Date();
    const discount = await tx.subscriptionDiscountCode.findUnique({ where: { code } });
    if (!discount || !discount.isActive || discount.validFrom > now || discount.validUntil <= now) {
      throw new ConflictException('کد تخفیف معتبر یا فعال نیست.');
    }
    if (discount.applicablePlanId && discount.applicablePlanId !== plan.id) {
      throw new ConflictException('این کد تخفیف برای پلن انتخابی قابل استفاده نیست.');
    }
    if (plan.priceRial < discount.minimumPurchaseRial) {
      throw new ConflictException('مبلغ این پلن به حداقل خرید کد تخفیف نمی‌رسد.');
    }
    const [organizationUsage, totalUsage] = await Promise.all([
      tx.subscriptionDiscountRedemption.count({
        where: { discountCodeId: discount.id, organizationId, status: { in: ['RESERVED', 'REDEEMED'] } },
      }),
      discount.maxRedemptions === null ? Promise.resolve(0) : tx.subscriptionDiscountRedemption.count({
        where: { discountCodeId: discount.id, status: { in: ['RESERVED', 'REDEEMED'] } },
      }),
    ]);
    if (organizationUsage >= discount.perOrganizationLimit) throw new ConflictException('سقف استفاده این سازمان از کد تخفیف تکمیل شده است.');
    if (discount.maxRedemptions !== null && totalUsage >= discount.maxRedemptions) throw new ConflictException('ظرفیت این کد تخفیف تکمیل شده است.');
    try {
      return { id: discount.id, code: discount.code, amountRial: calculateSubscriptionDiscount(plan.priceRial, discount) };
    } catch (error: unknown) {
      throw new ConflictException(error instanceof Error ? error.message : 'مقدار کد تخفیف معتبر نیست.');
    }
  }

  private async assertCustomerPurchasablePlan(planCode: string): Promise<void> {
    const founding = (await this.policySettings.get()).foundingProgram;
    if (planCode === founding.planCode && (!founding.enabled || founding.managedSalesOnly)) {
      throw new NotFoundException('این پلن فقط از طریق تیم فروش وازانو فعال می‌شود.');
    }
  }

  private async activateTrial(user: AuthenticatedUser, organizationId: string, plan: SubscriptionPlan, idempotencyKey: string) {
    const policy = await this.policySettings.get();
    return this.prisma.$transaction(async (tx) => {
      const existingRequest = await tx.subscription.findUnique({ where: { trialActivationKey: idempotencyKey } });
      if (existingRequest) {
        if (existingRequest.organizationId !== organizationId || existingRequest.planId !== plan.id || !existingRequest.isTrialSnapshot) {
          throw new ConflictException('کلید تکرارپذیری برای درخواست دیگری استفاده شده است.');
        }
        return { trialActivated: true as const, subscriptionId: existingRequest.id, startsAt: existingRequest.startsAt, expiresAt: existingRequest.expiresAt };
      }

      const current = await tx.subscription.findFirst({
        where: { organizationId, status: { in: ['ACTIVE', 'GRACE'] }, expiresAt: { gt: new Date() } },
        select: { id: true },
      });
      if (current) throw new ConflictException('برای حساب دارای اشتراک فعال، دوره آزمایشی قابل استفاده نیست.');

      const activatedAt = new Date();
      const claim = await tx.organization.updateMany({
        where: { id: organizationId, subscriptionTrialRedeemedAt: null },
        data: { subscriptionTrialRedeemedAt: activatedAt },
      });
      if (claim.count !== 1) {
        const completed = await tx.subscription.findUnique({ where: { trialActivationKey: idempotencyKey } });
        if (completed?.organizationId === organizationId && completed.planId === plan.id && completed.isTrialSnapshot) {
          return { trialActivated: true as const, subscriptionId: completed.id, startsAt: completed.startsAt, expiresAt: completed.expiresAt };
        }
        throw new ConflictException('دوره آزمایشی این حساب قبلاً استفاده شده است.');
      }

      const expiresAt = addBillingPeriod(activatedAt, plan.durationIso);
      const subscription = await tx.subscription.create({ data: {
        organizationId,
        planId: plan.id,
        status: 'ACTIVE',
        startsAt: activatedAt,
        expiresAt,
        graceEndsAt: expiresAt,
        priceRialSnapshot: 0n,
        listPriceRialSnapshot: 0n,
        grantCreditSnapshot: plan.grantCredits,
        planVersionSnapshot: plan.version,
        isTrialSnapshot: true,
        trialActivationKey: idempotencyKey,
      } });
      const wallet = await tx.creditWallet.upsert({
        where: { organizationId },
        create: { organizationId, cachedBalanceCredits: plan.grantCredits },
        update: { cachedBalanceCredits: { increment: plan.grantCredits } },
      });
      await tx.creditLedgerEntry.create({ data: {
        walletId: wallet.id,
        type: 'GRANT',
        amountCredits: plan.grantCredits,
        referenceType: 'Subscription',
        referenceId: subscription.id,
        idempotencyKey: `subscription:${subscription.id}:grant:v1`,
        reasonCode: 'SUBSCRIPTION_TRIAL_ACTIVATED',
      } });
      await tx.subscriptionReminder.updateMany({
        where: { subscription: { organizationId }, status: 'PENDING' },
        data: { status: 'CANCELLED', cancelledAt: activatedAt },
      });
      await tx.subscriptionReminder.createMany({
        data: buildTrialReminderSchedule(expiresAt, policy.trialWarningOffsetsDays).flatMap(({ offsetDays, scheduledAt }) =>
          (['SMS', 'IN_APP'] as const).map((channel) => ({ subscriptionId: subscription.id, offsetDays, scheduledAt, channel }))),
        skipDuplicates: true,
      });
      await tx.auditLog.create({ data: {
        actorUserId: user.id,
        organizationId,
        action: 'subscription.trial.activate',
        entityType: 'Subscription',
        entityId: subscription.id,
        metadata: { planCode: plan.code, durationIso: plan.durationIso },
      } });
      await tx.outboxEvent.create({ data: {
        aggregateType: 'Subscription',
        aggregateId: subscription.id,
        eventType: 'ir.vazano.subscription.trial_activated.v1',
        payload: { subscriptionId: subscription.id, organizationId, expiresAt: expiresAt.toISOString() },
      } });
      return { trialActivated: true as const, subscriptionId: subscription.id, startsAt: activatedAt, expiresAt };
    });
  }
}
