import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { SubscriptionSmsReminderService } from './subscription-sms-reminder.service';

const REMINDER_EVENT_TYPES: Readonly<Record<number, string>> = {
  [-14]: 'ir.vazano.subscription.renewal.14_days_before.v1',
  [-7]: 'ir.vazano.subscription.renewal.7_days_before.v1',
  [-3]: 'ir.vazano.subscription.renewal.3_days_before.v1',
  [0]: 'ir.vazano.subscription.renewal.expired.v1',
  [7]: 'ir.vazano.subscription.renewal.grace_ended.v1',
};

const TRIAL_REMINDER_EVENT_TYPES: Readonly<Record<number, string>> = {
  [-7]: 'ir.vazano.subscription.trial.7_days_before.v1',
  [-3]: 'ir.vazano.subscription.trial.3_days_before.v1',
  [-1]: 'ir.vazano.subscription.trial.1_day_before.v1',
  [0]: 'ir.vazano.subscription.trial.expired.v1',
};

@Injectable()
export class SubscriptionLifecycleService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly smsReminders: SubscriptionSmsReminderService,
  ) {}

  async process(now = new Date()): Promise<{ reminders: number; smsReminders: number; enteredGrace: number; expired: number; overdueInvoices: number }> {
    const [reminders, smsReminders, enteredGrace, expired, overdueInvoices] = await Promise.all([
      this.processDueInAppReminders(now),
      this.smsReminders.process(now),
      this.enterGracePeriod(now),
      this.finishGracePeriod(now),
      this.markOverdueInvoices(now),
    ]);
    return { reminders, smsReminders, enteredGrace, expired, overdueInvoices };
  }

  private async markOverdueInvoices(now: Date): Promise<number> {
    const invoices = await this.prisma.billingInvoice.findMany({
      where: { status: 'ISSUED', dueAt: { lt: now } },
      select: { id: true, subscriptionId: true },
      take: 100,
    });
    let updated = 0;
    for (const invoice of invoices) {
      const changed = await this.prisma.$transaction(async (tx) => {
        const result = await tx.billingInvoice.updateMany({
          where: { id: invoice.id, status: 'ISSUED' },
          data: { status: 'OVERDUE' },
        });
        if (result.count !== 1) return false;
        if (invoice.subscriptionId) {
          await tx.subscriptionDiscountRedemption.updateMany({
            where: { subscriptionId: invoice.subscriptionId, status: 'RESERVED' },
            data: { status: 'CANCELLED', cancelledAt: now },
          });
        }
        return true;
      });
      if (changed) updated += 1;
    }
    return updated;
  }

  private async processDueInAppReminders(now: Date): Promise<number> {
    const reminders = await this.prisma.subscriptionReminder.findMany({
      where: {
        channel: 'IN_APP',
        status: 'PENDING',
        scheduledAt: { lte: now },
        subscription: { status: { in: ['ACTIVE', 'GRACE', 'EXPIRED'] } },
      },
      select: { id: true, subscriptionId: true, offsetDays: true, subscription: { select: { isTrialSnapshot: true } } },
      orderBy: { scheduledAt: 'asc' },
      take: 100,
    });
    let processed = 0;
    for (const reminder of reminders) {
      const eventType = (reminder.subscription.isTrialSnapshot ? TRIAL_REMINDER_EVENT_TYPES : REMINDER_EVENT_TYPES)[reminder.offsetDays];
      if (!eventType) continue;
      const sent = await this.prisma.$transaction(async (tx) => {
        const result = await tx.subscriptionReminder.updateMany({
          where: { id: reminder.id, status: 'PENDING' },
          data: { status: 'SENT', sentAt: now },
        });
        if (result.count !== 1) return false;
        await tx.outboxEvent.create({
          data: {
            aggregateType: 'SubscriptionReminder',
            aggregateId: reminder.id,
            eventType,
            payload: { reminderId: reminder.id, subscriptionId: reminder.subscriptionId, offsetDays: reminder.offsetDays },
          },
        });
        return true;
      });
      if (sent) processed += 1;
    }
    return processed;
  }

  private async enterGracePeriod(now: Date): Promise<number> {
    const subscriptions = await this.prisma.subscription.findMany({
      where: { status: 'ACTIVE', isTrialSnapshot: false, expiresAt: { lte: now } },
      select: { id: true, organizationId: true },
      take: 100,
    });
    let updated = 0;
    for (const subscription of subscriptions) {
      const changed = await this.prisma.$transaction(async (tx) => {
        const result = await tx.subscription.updateMany({ where: { id: subscription.id, status: 'ACTIVE' }, data: { status: 'GRACE' } });
        if (result.count !== 1) return false;
        await tx.outboxEvent.create({
          data: {
            aggregateType: 'Subscription',
            aggregateId: subscription.id,
            eventType: 'ir.vazano.subscription.grace_started.v1',
            payload: { subscriptionId: subscription.id, organizationId: subscription.organizationId },
          },
        });
        return true;
      });
      if (changed) updated += 1;
    }
    return updated;
  }

  private async finishGracePeriod(now: Date): Promise<number> {
    const subscriptions = await this.prisma.subscription.findMany({
      where: {
        OR: [
          { status: 'GRACE', graceEndsAt: { lte: now } },
          { status: 'ACTIVE', isTrialSnapshot: true, expiresAt: { lte: now } },
        ],
      },
      select: { id: true, organizationId: true, status: true },
      take: 100,
    });
    let updated = 0;
    for (const subscription of subscriptions) {
      const changed = await this.prisma.$transaction(async (tx) => {
        const result = await tx.subscription.updateMany({ where: { id: subscription.id, status: subscription.status }, data: { status: 'EXPIRED' } });
        if (result.count !== 1) return false;
        await tx.outboxEvent.create({
          data: {
            aggregateType: 'Subscription',
            aggregateId: subscription.id,
            eventType: 'ir.vazano.subscription.expired.v1',
            payload: { subscriptionId: subscription.id, organizationId: subscription.organizationId },
          },
        });
        return true;
      });
      if (changed) updated += 1;
    }
    return updated;
  }
}
