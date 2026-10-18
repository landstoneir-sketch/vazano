import type { AuthenticatedUser } from '../auth/auth.types';
import { SubscriptionBillingService } from './subscription-billing.service';

const supplierOwner: AuthenticatedUser = {
  id: 'user-1',
  mobile: '09120000000',
  status: 'ACTIVE',
  permissions: [],
  globalRoles: [],
  memberships: [{ organizationId: 'supplier-1', role: 'SUPPLIER_OWNER' }],
};

describe('SubscriptionBillingService trial activation', () => {
  it('activates a free trial once without creating a payment request', async () => {
    const plan = {
      id: 'trial-plan-1', code: 'TRIAL_14D', nameFa: 'آزمایش ۱۴ روزه', descriptionFa: null,
      billingCycle: 'CUSTOM', durationIso: 'P14D', priceRial: 0n, grantCredits: 10n,
      dailyProposalLimit: 1, maxProposalLimit: 2, taxIncluded: false, isTrial: true,
      isPublic: true, isActive: true, version: 1, entitlements: {}, createdAt: new Date(), updatedAt: new Date(),
    } as const;
    const subscriptionCreate = jest.fn().mockResolvedValue({ id: 'subscription-1' });
    let reminderRows: Array<{ offsetDays: number; channel: string }> = [];
    const reminderCreateMany = jest.fn((input: { data: Array<{ offsetDays: number; channel: string }> }) => {
      reminderRows = input.data;
      return Promise.resolve({ count: input.data.length });
    });
    let activationEvent: { data: { eventType: string; payload: { activationSource?: string } } } | undefined;
    const tx = {
      subscription: {
        findUnique: jest.fn().mockResolvedValue(null),
        findFirst: jest.fn().mockResolvedValue(null),
        create: subscriptionCreate,
      },
      organization: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      creditWallet: { upsert: jest.fn().mockResolvedValue({ id: 'wallet-1' }) },
      creditLedgerEntry: { create: jest.fn().mockResolvedValue({}) },
      subscriptionReminder: {
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        createMany: reminderCreateMany,
      },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
      outboxEvent: { create: jest.fn((input: { data: { eventType: string; payload: { activationSource?: string } } }) => { activationEvent = input; return Promise.resolve({}); }) },
    };
    const prisma = {
      organization: { findUnique: jest.fn().mockResolvedValue({ id: 'supplier-1', kind: 'SUPPLIER', status: 'ACTIVE' }) },
      subscriptionPlan: { findFirst: jest.fn().mockResolvedValue(plan) },
      subscription: { findUnique: jest.fn().mockResolvedValue(null) },
      paymentIntent: { findUnique: jest.fn() },
      $transaction: jest.fn(async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx)),
    };
    const payments = { create: jest.fn() };
    const policySettings = { get: jest.fn().mockResolvedValue({
      gracePeriodDays: 7,
      renewalWarningOffsetsDays: [-14, -7, -3, 0, 7],
      trialWarningOffsetsDays: [-7, -3, -1, 0],
      sms: { startHour: 9, endHour: 20, timezone: 'Asia/Tehran', renewalMaxPer24Hours: 1 },
      foundingProgram: {
        enabled: true, planCode: 'SELLER_FOUNDING_P6M_V1', capacity: 20, renewalDiscountBps: 2000,
        minimumValidLeads: 10, guaranteeExtensionDays: 90, managedSalesOnly: true,
      },
    }) };
    const service = new SubscriptionBillingService(prisma as never, payments as never, {} as never, policySettings as never);

    await expect(service.startCheckout(supplierOwner, 'supplier-1', plan.id, 'trial-request-123')).resolves.toMatchObject({
      trialActivated: true,
      subscriptionId: 'subscription-1',
    });
    expect(payments.create).not.toHaveBeenCalled();
    expect(prisma.paymentIntent.findUnique).toHaveBeenCalledWith({ where: { idempotencyKey: 'trial-request-123' } });
    expect(subscriptionCreate).toHaveBeenCalledTimes(1);
    expect(reminderCreateMany).toHaveBeenCalledTimes(1);
    expect([...new Set(reminderRows.map((item) => item.offsetDays))]).toEqual([-7, -3, -1, 0]);
    expect(reminderRows).toHaveLength(8);
    expect(activationEvent?.data.eventType).toBe('ir.vazano.subscription.activated.v1');
    expect(activationEvent?.data.payload.activationSource).toBe('TRIAL');
  });
});

describe('SubscriptionBillingService unsuccessful payment', () => {
  it('closes financial records, releases discount capacity, and emits one retry event', async () => {
    const intent = {
      id: 'payment-1', referenceId: 'subscription-1', provider: 'ZARINPAL', purpose: 'SUBSCRIPTION',
      status: 'REDIRECT_PENDING', authority: 'authority-1', amountRial: 9_000_000n,
    };
    const tx = {
      paymentIntent: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      subscription: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUniqueOrThrow: jest.fn().mockResolvedValue({ organizationId: 'supplier-1' }),
      },
      billingInvoice: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      subscriptionDiscountRedemption: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
      outboxEvent: { create: jest.fn().mockResolvedValue({}) },
    };
    const prisma = {
      paymentIntent: { findFirst: jest.fn().mockResolvedValue(intent) },
      $transaction: jest.fn(async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx)),
    };
    const payments = { provider: 'ZARINPAL' };
    const service = new SubscriptionBillingService(prisma as never, payments as never, {} as never, { get: jest.fn() } as never);

    await expect(service.handleCallback('authority-1', 'NOK')).resolves.toEqual({ success: false, cancelled: true });
    expect(tx.subscription.updateMany).toHaveBeenCalledWith({
      where: { id: 'subscription-1', status: 'DRAFT' }, data: { status: 'CANCELLED' },
    });
    expect(tx.subscriptionDiscountRedemption.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { subscriptionId: 'subscription-1', status: 'RESERVED' },
    }));
    expect(tx.outboxEvent.create).toHaveBeenCalledWith({ data: {
      aggregateType: 'PaymentIntent', aggregateId: 'payment-1', eventType: 'ir.vazano.payment.retry_requested.v1',
      payload: { paymentId: 'payment-1', subscriptionId: 'subscription-1', status: 'CANCELLED' },
    } });
  });

  it('does not verify or reactivate a payment that is already terminal', async () => {
    const prisma = {
      paymentIntent: { findFirst: jest.fn().mockResolvedValue({
        id: 'payment-closed', referenceId: 'subscription-closed', provider: 'ZARINPAL', purpose: 'SUBSCRIPTION',
        status: 'CANCELLED', authority: 'authority-closed', amountRial: 9_000_000n,
      }) },
    };
    const payments = { provider: 'ZARINPAL', verify: jest.fn() };
    const service = new SubscriptionBillingService(prisma as never, payments as never, {} as never, { get: jest.fn() } as never);

    await expect(service.handleCallback('authority-closed', 'OK')).resolves.toEqual({ success: false, cancelled: true });
    expect(payments.verify).not.toHaveBeenCalled();
  });

  it('reports a lost callback claim according to the committed payment status', async () => {
    const intent = {
      id: 'payment-race', referenceId: 'subscription-race', provider: 'ZARINPAL', purpose: 'SUBSCRIPTION',
      status: 'REDIRECT_PENDING', authority: 'authority-race', amountRial: 9_000_000n,
    };
    const tx = {
      paymentIntent: {
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        findUniqueOrThrow: jest.fn().mockResolvedValue({ ...intent, status: 'CANCELLED' }),
      },
    };
    const prisma = {
      paymentIntent: { findFirst: jest.fn().mockResolvedValue(intent) },
      $transaction: jest.fn(async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx)),
    };
    const payments = {
      provider: 'ZARINPAL',
      verify: jest.fn().mockResolvedValue({ success: true, alreadyVerified: false, referenceId: 'ref-race', code: 100 }),
    };
    const service = new SubscriptionBillingService(prisma as never, payments as never, {} as never, { get: jest.fn().mockResolvedValue({}) } as never);

    await expect(service.handleCallback('authority-race', 'OK')).resolves.toMatchObject({ success: false, cancelled: true });
    expect(tx.paymentIntent.updateMany).toHaveBeenCalledWith({
      where: { id: 'payment-race', status: 'REDIRECT_PENDING' }, data: { status: 'VERIFY_PENDING' },
    });
  });
});

describe('SubscriptionBillingService paid checkout idempotency', () => {
  const paidPlan = {
    id: 'paid-plan-1', code: 'SELLER_STANDARD_M1_V1', nameFa: 'استاندارد ماهانه',
    priceRial: 10_000_000n, grantCredits: 20n, version: 1, isTrial: false,
  };
  const draftSubscription = {
    id: 'subscription-paid-1', organizationId: 'supplier-1', planId: paidPlan.id,
    priceRialSnapshot: paidPlan.priceRial, discountCodeSnapshot: null,
  };
  const foundingPolicy = {
    foundingProgram: {
      enabled: true, planCode: 'SELLER_FOUNDING_P6M_V1', capacity: 20, renewalDiscountBps: 2000,
      minimumValidLeads: 10, guaranteeExtensionDays: 90, managedSalesOnly: true,
    },
  };

  it('returns processing without creating another provider request while the first request is being prepared', async () => {
    const intent = {
      id: 'payment-pending-1', referenceId: draftSubscription.id, provider: 'ZARINPAL', purpose: 'SUBSCRIPTION',
      payerOrganizationId: 'supplier-1', status: 'REDIRECT_PENDING', authority: null,
      amountRial: paidPlan.priceRial,
    };
    const prisma = {
      organization: { findUnique: jest.fn().mockResolvedValue({ id: 'supplier-1', kind: 'SUPPLIER', status: 'ACTIVE' }) },
      subscriptionPlan: { findFirst: jest.fn().mockResolvedValue(paidPlan) },
      paymentIntent: { findUnique: jest.fn().mockResolvedValue(intent), updateMany: jest.fn() },
      subscription: {
        findUnique: jest.fn().mockImplementation(({ where }: { where: { idempotencyKey?: string; trialActivationKey?: string } }) =>
          where.trialActivationKey ? null : draftSubscription),
        findUniqueOrThrow: jest.fn().mockResolvedValue(draftSubscription),
      },
    };
    const payments = { provider: 'ZARINPAL', create: jest.fn() };
    const config = { get: jest.fn() };
    const service = new SubscriptionBillingService(prisma as never, payments as never, config as never, { get: jest.fn().mockResolvedValue(foundingPolicy) } as never);

    await expect(service.startCheckout(supplierOwner, 'supplier-1', paidPlan.id, 'same-checkout-key')).resolves.toEqual({
      paymentIntentId: intent.id,
      subscriptionId: draftSubscription.id,
      processing: true,
    });
    expect(prisma.paymentIntent.updateMany).not.toHaveBeenCalled();
    expect(payments.create).not.toHaveBeenCalled();
  });

  it('claims a created intent before contacting the payment provider', async () => {
    const events: string[] = [];
    const intent = {
      id: 'payment-created-1', referenceId: draftSubscription.id, provider: 'ZARINPAL', purpose: 'SUBSCRIPTION',
      payerOrganizationId: 'supplier-1', status: 'CREATED', authority: null,
      amountRial: paidPlan.priceRial,
    };
    const prisma = {
      organization: { findUnique: jest.fn().mockResolvedValue({ id: 'supplier-1', kind: 'SUPPLIER', status: 'ACTIVE' }) },
      subscriptionPlan: { findFirst: jest.fn().mockResolvedValue(paidPlan) },
      paymentIntent: {
        findUnique: jest.fn().mockResolvedValue(intent),
        updateMany: jest.fn().mockImplementation(() => { events.push('claim'); return Promise.resolve({ count: 1 }); }),
        update: jest.fn().mockResolvedValue({}),
      },
      subscription: {
        findUnique: jest.fn().mockImplementation(({ where }: { where: { trialActivationKey?: string } }) =>
          where.trialActivationKey ? null : draftSubscription),
        findUniqueOrThrow: jest.fn().mockResolvedValue(draftSubscription),
      },
      billingInvoice: { upsert: jest.fn().mockResolvedValue({}) },
    };
    const payments = {
      provider: 'ZARINPAL',
      create: jest.fn().mockImplementation(() => {
        events.push('provider');
        return Promise.resolve({ authority: 'A12345678901234567890', redirectUrl: 'https://gateway.example/start' });
      }),
    };
    const config = { get: jest.fn().mockReturnValue('http://localhost:3001') };
    const service = new SubscriptionBillingService(prisma as never, payments as never, config as never, { get: jest.fn().mockResolvedValue(foundingPolicy) } as never);

    await expect(service.startCheckout(supplierOwner, 'supplier-1', paidPlan.id, 'same-checkout-key')).resolves.toMatchObject({
      paymentIntentId: intent.id,
      authority: 'A12345678901234567890',
    });
    expect(events).toEqual(['claim', 'provider']);
    expect(prisma.paymentIntent.updateMany).toHaveBeenCalledWith({
      where: { id: intent.id, status: 'CREATED', authority: null },
      data: { status: 'REDIRECT_PENDING' },
    });
    expect(payments.create).toHaveBeenCalledTimes(1);
  });
});
