import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AuthenticatedUser } from '../auth/auth.types';
import { PaymentsService } from '../payments/payments.service';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { addBillingPeriod, buildRenewalReminderSchedule, SUBSCRIPTION_GRACE_PERIOD_DAYS } from './subscription-policies';
import { buildPaymentReceiptSnapshot } from './payment-receipt-policy';

@Injectable()
export class SubscriptionBillingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly payments: PaymentsService,
    private readonly config: ConfigService,
  ) {}

  async startCheckout(user: AuthenticatedUser, organizationId: string, planId: string, idempotencyKey: string) {
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

    const existingIntent = await this.prisma.paymentIntent.findUnique({ where: { idempotencyKey } });
    if (existingIntent && (existingIntent.purpose !== 'SUBSCRIPTION' || existingIntent.payerOrganizationId !== organizationId || existingIntent.amountRial !== plan.priceRial)) {
      throw new ConflictException('کلید تکرارپذیری برای درخواست دیگری استفاده شده است.');
    }
    if (existingIntent?.authority && ['REDIRECT_PENDING', 'VERIFY_PENDING', 'SUCCEEDED'].includes(existingIntent.status)) {
      const callbackUrl = `${this.publicApiUrl()}/v1/subscriptions/zarinpal/callback`;
      return { paymentIntentId: existingIntent.id, subscriptionId: existingIntent.referenceId, authority: existingIntent.authority, redirectUrl: this.payments.redirectUrl(existingIntent.authority, callbackUrl) };
    }

    const subscription = existingIntent
      ? await this.prisma.subscription.findUniqueOrThrow({ where: { id: existingIntent.referenceId } })
      : await this.prisma.subscription.create({ data: { organizationId, planId: plan.id, priceRialSnapshot: plan.priceRial, grantCreditSnapshot: plan.grantCredits, planVersionSnapshot: plan.version } });
    if (subscription.planId !== plan.id || subscription.organizationId !== organizationId) {
      throw new ConflictException('درخواست پرداخت با پلن انتخابی سازگار نیست.');
    }
    const intent = existingIntent ?? await this.prisma.paymentIntent.create({
      data: { provider: this.payments.provider, purpose: 'SUBSCRIPTION', amountRial: plan.priceRial, payerOrganizationId: organizationId, referenceType: 'Subscription', referenceId: subscription.id, idempotencyKey },
    });
    try {
      const result = await this.payments.create({ amountRial: intent.amountRial, description: `خرید ${plan.nameFa}`, callbackUrl: `${this.publicApiUrl()}/v1/subscriptions/zarinpal/callback`, mobile: user.mobile, orderId: subscription.id });
      await this.prisma.paymentIntent.update({ where: { id: intent.id }, data: { authority: result.authority, status: 'REDIRECT_PENDING' } });
      return { paymentIntentId: intent.id, subscriptionId: subscription.id, ...result };
    } catch (error) {
      await this.prisma.paymentIntent.update({ where: { id: intent.id }, data: { status: 'FAILED' } });
      throw error;
    }
  }

  async handleCallback(authority: string, callbackStatus: 'OK' | 'NOK') {
    const intent = await this.prisma.paymentIntent.findFirst({ where: { authority, provider: this.payments.provider, purpose: 'SUBSCRIPTION' } });
    if (!intent) throw new NotFoundException('تراکنش اشتراک پیدا نشد.');
    if (intent.status === 'SUCCEEDED') return { success: true, alreadyVerified: true, referenceId: intent.providerReference };
    if (callbackStatus !== 'OK') {
      await this.prisma.paymentIntent.updateMany({ where: { id: intent.id, status: { not: 'SUCCEEDED' } }, data: { status: 'CANCELLED', callbackPayload: { status: callbackStatus } } });
      return { success: false, cancelled: true };
    }
    const verification = await this.payments.verify({ amountRial: intent.amountRial, authority });
    if (!verification.success) {
      await this.prisma.paymentIntent.updateMany({ where: { id: intent.id, status: { not: 'SUCCEEDED' } }, data: { status: 'FAILED', callbackPayload: { status: callbackStatus, code: verification.code } } });
      return verification;
    }

    return this.prisma.$transaction(async (tx) => {
      const claim = await tx.paymentIntent.updateMany({
        where: { id: intent.id, status: { not: 'SUCCEEDED' } },
        data: { status: 'VERIFY_PENDING' },
      });
      if (claim.count === 0) {
        const completed = await tx.paymentIntent.findUniqueOrThrow({ where: { id: intent.id } });
        return { success: true, alreadyVerified: true, referenceId: completed.providerReference };
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
      const graceEndsAt = new Date(expiresAt.getTime() + SUBSCRIPTION_GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000);
      const schedule = buildRenewalReminderSchedule(expiresAt);
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
      await tx.paymentIntent.update({ where: { id: intent.id }, data: { status: 'SUCCEEDED', providerReference: verification.referenceId, verifiedAt: paidAt, callbackPayload: { status: callbackStatus, code: verification.code } } });
      await tx.auditLog.create({ data: { organizationId: subscription.organizationId, action: 'subscription.activate', entityType: 'Subscription', entityId: subscription.id, metadata: { paymentIntentId: intent.id, planCode: subscription.plan.code } } });
      await tx.outboxEvent.create({ data: { aggregateType: 'Subscription', aggregateId: subscription.id, eventType: 'ir.vazano.subscription.activated.v1', payload: { subscriptionId: subscription.id, organizationId: subscription.organizationId, receiptNumber: receipt.receiptNumber } } });
      return { ...verification, receiptNumber: receipt.receiptNumber };
    });
  }

  private publicApiUrl(): string {
    return (this.config.get<string>('PUBLIC_API_URL') ?? 'http://localhost:3001').replace(/\/$/, '');
  }
}
