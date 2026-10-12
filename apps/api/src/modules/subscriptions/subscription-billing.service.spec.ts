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
      outboxEvent: { create: jest.fn().mockResolvedValue({}) },
    };
    const prisma = {
      organization: { findUnique: jest.fn().mockResolvedValue({ id: 'supplier-1', kind: 'SUPPLIER', status: 'ACTIVE' }) },
      subscriptionPlan: { findFirst: jest.fn().mockResolvedValue(plan) },
      subscription: { findUnique: jest.fn().mockResolvedValue(null) },
      paymentIntent: { findUnique: jest.fn() },
      $transaction: jest.fn(async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx)),
    };
    const payments = { create: jest.fn() };
    const service = new SubscriptionBillingService(prisma as never, payments as never, {} as never);

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
  });
});
