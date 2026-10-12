import { ConflictException } from '@nestjs/common';
import { PaymentReconciliationResolution, Prisma } from '@prisma/client';
import type { AuthenticatedUser } from '../auth/auth.types';
import { AdminBillingService } from './admin-billing.service';

const financeUser: AuthenticatedUser = {
  id: 'finance-1', mobile: '09120000000', status: 'ACTIVE', permissions: ['billing.manage'], globalRoles: ['FINANCE'], memberships: [],
};

describe('AdminBillingService payment reconciliation resolution', () => {
  it('records a finance decision without changing payment status', async () => {
    let updateInput: Prisma.PaymentIntentUpdateManyArgs | undefined;
    const payment = {
      id: 'payment-1', payerOrganizationId: 'organization-1', purpose: 'SUBSCRIPTION', status: 'FAILED',
      reconciliationStatus: 'ACTION_REQUIRED', reconciliationResolvedAt: null,
    };
    const tx = {
      paymentIntent: {
        updateMany: jest.fn((input: Prisma.PaymentIntentUpdateManyArgs) => { updateInput = input; return Promise.resolve({ count: 1 }); }),
        findUniqueOrThrow: jest.fn().mockResolvedValue({ ...payment, reconciliationResolvedAt: new Date() }),
      },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
      outboxEvent: { create: jest.fn().mockResolvedValue({}) },
    };
    const prisma = {
      paymentIntent: { findUnique: jest.fn().mockResolvedValue(payment) },
      $transaction: jest.fn(async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx)),
    };
    const service = new AdminBillingService(prisma as never, {} as never, {} as never);

    await service.resolvePaymentReconciliation(financeUser, payment.id, {
      resolution: PaymentReconciliationResolution.CUSTOMER_RETRY_REQUIRED, note: 'ارسال مسیر امن پرداخت مجدد به مشتری ثبت شد.',
    });

    expect(updateInput?.where).toEqual({ id: payment.id, reconciliationResolvedAt: null, reconciliationStatus: 'ACTION_REQUIRED' });
    expect(updateInput?.data).toMatchObject({
      reconciliationResolution: PaymentReconciliationResolution.CUSTOMER_RETRY_REQUIRED,
      reconciliationResolutionNote: 'ارسال مسیر امن پرداخت مجدد به مشتری ثبت شد.',
      reconciliationResolvedByUserId: financeUser.id,
    });
    expect(updateInput?.data).not.toHaveProperty('status');
    expect(tx.auditLog.create).toHaveBeenCalledTimes(1);
    expect(tx.outboxEvent.create).toHaveBeenCalledWith({ data: {
      aggregateType: 'PaymentIntent', aggregateId: payment.id,
      eventType: 'ir.vazano.payment.retry_requested.v1',
      payload: { paymentId: payment.id, payerOrganizationId: payment.payerOrganizationId, purpose: payment.purpose },
    } });
  });

  it('rejects resolution for a reconciled payment', async () => {
    const prisma = {
      paymentIntent: { findUnique: jest.fn().mockResolvedValue({ id: 'payment-1', reconciliationStatus: 'MATCHED' }) },
    };
    const service = new AdminBillingService(prisma as never, {} as never, {} as never);

    await expect(service.resolvePaymentReconciliation(financeUser, 'payment-1', {
      resolution: PaymentReconciliationResolution.NO_FINANCIAL_ACTION, note: 'تراکنش قبلاً به‌طور قطعی تطبیق شده است.',
    })).rejects.toBeInstanceOf(ConflictException);
  });
});

describe('AdminBillingService renewal reminder retry', () => {
  it('requeues a failed SMS reminder and records the finance action', async () => {
    const reminder = {
      id: 'reminder-1', channel: 'SMS', status: 'FAILED', subscription: { organizationId: 'organization-1' },
    };
    const tx = {
      subscriptionReminder: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUniqueOrThrow: jest.fn().mockResolvedValue({ ...reminder, status: 'PENDING' }),
      },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
    };
    const prisma = {
      subscriptionReminder: { findUnique: jest.fn().mockResolvedValue(reminder) },
      $transaction: jest.fn(async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx)),
    };
    const service = new AdminBillingService(prisma as never, {} as never, {} as never);

    await expect(service.retryReminder(financeUser, reminder.id)).resolves.toMatchObject({ status: 'PENDING' });
    expect(tx.subscriptionReminder.updateMany).toHaveBeenCalledWith({
      where: { id: reminder.id, channel: 'SMS', status: 'FAILED' },
      data: { status: 'PENDING', sentAt: null, cancelledAt: null, failureReason: null },
    });
    expect(tx.auditLog.create).toHaveBeenCalledWith({ data: {
      actorUserId: financeUser.id,
      organizationId: reminder.subscription.organizationId,
      action: 'subscription.reminder.sms.requeued',
      entityType: 'SubscriptionReminder',
      entityId: reminder.id,
    } });
  });
});

describe('AdminBillingService manual subscription renewal', () => {
  it('atomically activates a paid plan and records the operator and tracking number', async () => {
    const organization = { id: 'organization-1', kind: 'SUPPLIER', status: 'ACTIVE' };
    const plan = { id: 'plan-1', code: 'PRO', isActive: true, isTrial: false, durationIso: 'P1M', grantCredits: 20n, version: 3 };
    const subscription = { id: 'subscription-1', organizationId: organization.id, planId: plan.id };
    const manualRenewal = { id: 'renewal-1', subscriptionId: subscription.id, trackingNumber: 'BANK-123' };
    let renewalInput: { data: { activatedByUserId: string; trackingNumber: string; amountRial: bigint } } | undefined;
    let creditInput: { data: { reasonCode?: string | null } } | undefined;
    let auditInput: { data: { action: string } } | undefined;
    let outboxInput: { data: { eventType: string } } | undefined;
    const tx = {
      subscription: { findFirst: jest.fn().mockResolvedValue(null), create: jest.fn().mockResolvedValue(subscription) },
      manualSubscriptionRenewal: { create: jest.fn((input: { data: { activatedByUserId: string; trackingNumber: string; amountRial: bigint } }) => { renewalInput = input; return Promise.resolve(manualRenewal); }) },
      creditWallet: { upsert: jest.fn().mockResolvedValue({ id: 'wallet-1' }) },
      creditLedgerEntry: { create: jest.fn((input: { data: { reasonCode?: string | null } }) => { creditInput = input; return Promise.resolve({}); }) },
      subscriptionReminder: { updateMany: jest.fn().mockResolvedValue({ count: 0 }), createMany: jest.fn().mockResolvedValue({ count: 10 }) },
      auditLog: { create: jest.fn((input: { data: { action: string } }) => { auditInput = input; return Promise.resolve({}); }) },
      outboxEvent: { create: jest.fn((input: { data: { eventType: string } }) => { outboxInput = input; return Promise.resolve({}); }) },
    };
    const prisma = {
      manualSubscriptionRenewal: { findUnique: jest.fn().mockResolvedValue(null) },
      organization: { findUnique: jest.fn().mockResolvedValue(organization) },
      subscriptionPlan: { findUnique: jest.fn().mockResolvedValue(plan) },
      $transaction: jest.fn(async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx)),
    };
    const service = new AdminBillingService(prisma as never, {} as never, {} as never);

    await expect(service.createManualRenewal(financeUser, {
      organizationId: organization.id,
      planId: plan.id,
      amountRial: '300000000',
      trackingNumber: ' bank-123 ',
      paidAt: new Date(Date.now() - 60_000).toISOString(),
      note: 'واریز بانکی پس از بررسی سند پرداخت ثبت شد.',
    })).resolves.toEqual({ manualRenewal, subscription });

    expect(renewalInput?.data).toMatchObject({
      activatedByUserId: financeUser.id,
      trackingNumber: 'BANK-123',
      amountRial: 300000000n,
    });
    expect(creditInput?.data.reasonCode).toBe('SUBSCRIPTION_MANUAL_RENEWAL');
    expect(auditInput?.data.action).toBe('subscription.manual_renewal.create');
    expect(outboxInput?.data.eventType).toBe('ir.vazano.subscription.manual_renewal_activated.v1');
  });

  it('rejects a reused tracking number before changing subscription state', async () => {
    const prisma = { manualSubscriptionRenewal: { findUnique: jest.fn().mockResolvedValue({ id: 'existing' }) } };
    const service = new AdminBillingService(prisma as never, {} as never, {} as never);

    await expect(service.createManualRenewal(financeUser, {
      organizationId: 'organization-1', planId: 'plan-1', amountRial: '1000', trackingNumber: 'BANK-123',
      paidAt: new Date(Date.now() - 60_000).toISOString(), note: 'شماره پیگیری تکراری برای آزمون ثبت شد.',
    })).rejects.toBeInstanceOf(ConflictException);
  });
});
