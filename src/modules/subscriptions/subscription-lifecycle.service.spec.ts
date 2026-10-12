import { SubscriptionLifecycleService } from './subscription-lifecycle.service';

describe('SubscriptionLifecycleService', () => {
  it('claims a due reminder once and transitions expired subscriptions through grace', async () => {
    const tx = {
      subscriptionReminder: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      subscription: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      outboxEvent: { create: jest.fn().mockResolvedValue({}) },
    };
    const prisma = {
      subscriptionReminder: {
        findMany: jest.fn().mockResolvedValue([{ id: 'reminder-1', subscriptionId: 'subscription-1', offsetDays: -7, subscription: { isTrialSnapshot: false } }]),
      },
      subscription: {
        findMany: jest.fn()
          .mockResolvedValueOnce([{ id: 'subscription-2', organizationId: 'supplier-1' }])
          .mockResolvedValueOnce([{ id: 'subscription-3', organizationId: 'supplier-2', status: 'GRACE' }]),
      },
      $transaction: jest.fn(async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx)),
    };
    const smsReminders = { process: jest.fn().mockResolvedValue(1) };
    const service = new SubscriptionLifecycleService(prisma as never, smsReminders as never);

    await expect(service.process(new Date('2026-10-07T10:00:00.000Z'))).resolves.toEqual({ reminders: 1, smsReminders: 1, enteredGrace: 1, expired: 1 });
    expect(tx.outboxEvent.create).toHaveBeenCalledWith({
      data: {
        aggregateType: 'SubscriptionReminder',
        aggregateId: 'reminder-1',
        eventType: 'ir.vazano.subscription.renewal.7_days_before.v1',
        payload: { reminderId: 'reminder-1', subscriptionId: 'subscription-1', offsetDays: -7 },
      },
    });
  });

  it('does not emit a reminder when another worker already claimed it', async () => {
    const tx = {
      subscriptionReminder: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
      subscription: { updateMany: jest.fn() },
      outboxEvent: { create: jest.fn() },
    };
    const prisma = {
      subscriptionReminder: { findMany: jest.fn().mockResolvedValue([{ id: 'reminder-1', subscriptionId: 'subscription-1', offsetDays: -3, subscription: { isTrialSnapshot: false } }]) },
      subscription: { findMany: jest.fn().mockResolvedValue([]) },
      $transaction: jest.fn(async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx)),
    };
    const smsReminders = { process: jest.fn().mockResolvedValue(0) };
    const service = new SubscriptionLifecycleService(prisma as never, smsReminders as never);

    await expect(service.process()).resolves.toEqual({ reminders: 0, smsReminders: 0, enteredGrace: 0, expired: 0 });
    expect(tx.outboxEvent.create).not.toHaveBeenCalled();
  });
});
