import { SubscriptionSmsReminderService } from './subscription-sms-reminder.service';

describe('SubscriptionSmsReminderService', () => {
  it('does not query or send when subscription SMS is disabled', async () => {
    const prisma = { subscriptionReminder: { findMany: jest.fn() } };
    const config = { get: jest.fn().mockReturnValue('false') };
    const sms = { sendTemplate: jest.fn() };
    const service = new SubscriptionSmsReminderService(prisma as never, config as never, sms as never);

    await expect(service.process(new Date('2026-10-12T08:00:00.000Z'))).resolves.toBe(0);
    expect(prisma.subscriptionReminder.findMany).not.toHaveBeenCalled();
    expect(sms.sendTemplate).not.toHaveBeenCalled();
  });

  it('sends the latest due reminder once and cancels older reminders', async () => {
    const reminder = {
      id: 'reminder-14',
      subscriptionId: 'subscription-1',
      offsetDays: -14,
      scheduledAt: new Date('2026-10-12T07:00:00.000Z'),
      subscription: {
        organizationId: 'supplier-1',
        expiresAt: new Date('2026-10-26T00:00:00.000Z'),
        graceEndsAt: new Date('2026-11-02T00:00:00.000Z'),
        priceRialSnapshot: 30_000_000n,
        organization: { members: [{ user: { mobile: '09120000000' } }] },
      },
    };
    const updateMany = jest.fn().mockResolvedValueOnce({ count: 1 }).mockResolvedValueOnce({ count: 2 });
    const prisma = {
      subscriptionReminder: {
        findMany: jest.fn().mockResolvedValue([reminder]),
        updateMany,
      },
      auditLog: { count: jest.fn().mockResolvedValue(0), create: jest.fn().mockResolvedValue({ id: 'audit-1' }) },
      $transaction: jest.fn(async (operations: Promise<unknown>[]) => Promise.all(operations)),
    };
    const config = {
      get: jest.fn((key: string) => key === 'SUBSCRIPTION_SMS_ENABLED' ? 'true' : undefined),
      getOrThrow: jest.fn().mockReturnValue('https://vazano.ir'),
    };
    const sms = { sendTemplate: jest.fn().mockResolvedValue(undefined) };
    const service = new SubscriptionSmsReminderService(prisma as never, config as never, sms as never);

    await expect(service.process(new Date('2026-10-12T08:00:00.000Z'))).resolves.toBe(1);
    expect(sms.sendTemplate).toHaveBeenCalledWith('09120000000', 'SUBSCRIPTION_RENEWAL_14_DAYS', expect.arrayContaining([
      { name: 'Amount', value: '3000000' },
      { name: 'Link', value: 'https://vazano.ir/supplier/subscription' },
    ]));
    expect(prisma.auditLog.create).toHaveBeenCalled();
  });
});
