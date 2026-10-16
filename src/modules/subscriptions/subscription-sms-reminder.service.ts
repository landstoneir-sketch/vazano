import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { SMS_PORT, type SmsPort, type SmsTemplateCode, type SmsTemplateParameter } from '../auth/sms/sms.port';
import { SubscriptionPolicySettingsService, type SubscriptionPolicySettings } from './subscription-policy-settings.service';

const SMS_TEMPLATE_BY_OFFSET: Readonly<Record<number, SmsTemplateCode>> = {
  [-14]: 'SUBSCRIPTION_RENEWAL_14_DAYS',
  [-7]: 'SUBSCRIPTION_RENEWAL_7_DAYS',
  [-3]: 'SUBSCRIPTION_RENEWAL_3_DAYS',
  [0]: 'SUBSCRIPTION_EXPIRED',
  [7]: 'SUBSCRIPTION_GRACE_ENDED',
};

const TRIAL_SMS_TEMPLATE_BY_OFFSET: Readonly<Record<number, SmsTemplateCode>> = {
  [-7]: 'SUBSCRIPTION_TRIAL_7_DAYS',
  [-3]: 'SUBSCRIPTION_TRIAL_3_DAYS',
  [-1]: 'SUBSCRIPTION_TRIAL_1_DAY',
  [0]: 'SUBSCRIPTION_TRIAL_ENDED',
};

const SUBSCRIPTION_LINK_PATH = 'supplier/subscription';
const PATH_PARAMETER_TEMPLATES: ReadonlySet<SmsTemplateCode> = new Set([
  'SUBSCRIPTION_RENEWAL_14_DAYS',
  'SUBSCRIPTION_RENEWAL_7_DAYS',
  'SUBSCRIPTION_TRIAL_3_DAYS',
]);

@Injectable()
export class SubscriptionSmsReminderService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    @Inject(SMS_PORT) private readonly sms: SmsPort,
    private readonly policySettings: SubscriptionPolicySettingsService,
  ) {}

  async process(now = new Date()): Promise<number> {
    if (this.config.get<string>('SUBSCRIPTION_SMS_ENABLED', 'false') !== 'true') return 0;
    const policy = await this.policySettings.get();
    if (!this.isWithinDeliveryWindow(now, policy.sms)) return 0;
    const reminders = await this.prisma.subscriptionReminder.findMany({
      where: {
        channel: 'SMS',
        status: 'PENDING',
        scheduledAt: { lte: now },
        subscription: { status: { in: ['ACTIVE', 'GRACE', 'EXPIRED'] } },
      },
      select: {
        id: true,
        subscriptionId: true,
        offsetDays: true,
        scheduledAt: true,
        subscription: {
          select: {
            organizationId: true,
            expiresAt: true,
            graceEndsAt: true,
            priceRialSnapshot: true,
            isTrialSnapshot: true,
            organization: {
              select: {
                members: {
                  where: { status: 'ACTIVE', role: 'SUPPLIER_OWNER' },
                  orderBy: { createdAt: 'asc' },
                  take: 1,
                  select: { user: { select: { mobile: true } } },
                },
              },
            },
          },
        },
      },
      orderBy: { scheduledAt: 'desc' },
      take: 100,
    });

    const processedSubscriptions = new Set<string>();
    let sent = 0;
    for (const reminder of reminders) {
      if (processedSubscriptions.has(reminder.subscriptionId)) continue;
      processedSubscriptions.add(reminder.subscriptionId);
      const templateCode = (reminder.subscription.isTrialSnapshot ? TRIAL_SMS_TEMPLATE_BY_OFFSET : SMS_TEMPLATE_BY_OFFSET)[reminder.offsetDays];
      const mobile = reminder.subscription.organization.members[0]?.user.mobile;
      if (!templateCode || !mobile) {
        await this.failReminder(reminder.id, templateCode ? 'RECIPIENT_NOT_FOUND' : 'TEMPLATE_NOT_SUPPORTED');
        continue;
      }

      const sentWithinLastDay = await this.prisma.auditLog.count({
        where: {
          organizationId: reminder.subscription.organizationId,
          action: 'subscription.reminder.sms.sent',
          createdAt: { gte: new Date(now.getTime() - 86_400_000) },
        },
      });
      if (sentWithinLastDay >= policy.sms.renewalMaxPer24Hours) continue;

      const claimed = await this.prisma.subscriptionReminder.updateMany({
        where: { id: reminder.id, status: 'PENDING' },
        data: { status: 'SENT', sentAt: now, failureReason: null },
      });
      if (claimed.count !== 1) continue;

      try {
        await this.sms.sendTemplate(mobile, templateCode, this.parameters(templateCode, reminder.subscription));
        await this.prisma.$transaction([
          this.prisma.subscriptionReminder.updateMany({
            where: {
              subscriptionId: reminder.subscriptionId,
              channel: 'SMS',
              status: 'PENDING',
              scheduledAt: { lt: reminder.scheduledAt },
            },
            data: { status: 'CANCELLED', cancelledAt: now, failureReason: 'SUPERSEDED_BY_LATEST_REMINDER' },
          }),
          this.prisma.auditLog.create({
            data: {
              organizationId: reminder.subscription.organizationId,
              action: 'subscription.reminder.sms.sent',
              entityType: 'SubscriptionReminder',
              entityId: reminder.id,
              metadata: { templateCode, offsetDays: reminder.offsetDays },
            },
          }),
        ]);
        sent += 1;
      } catch (error: unknown) {
        await this.failReminder(reminder.id, error instanceof Error ? error.name : 'SMS_DELIVERY_FAILED');
      }
    }
    return sent;
  }

  private parameters(templateCode: SmsTemplateCode, subscription: {
    expiresAt: Date | null;
    graceEndsAt: Date | null;
    priceRialSnapshot: bigint;
  }): SmsTemplateParameter[] {
    // SMS.ir requires the domain to remain literal in the approved template and
    // only accepts the trailing path as a variable (vazano.ir/#LINK#).
    const linkParameter: SmsTemplateParameter = {
      name: PATH_PARAMETER_TEMPLATES.has(templateCode) ? 'Path' : 'Link',
      value: SUBSCRIPTION_LINK_PATH,
    };
    const expiryDate = this.formatDate(subscription.expiresAt);
    if (templateCode === 'SUBSCRIPTION_RENEWAL_14_DAYS') {
      return [{ name: 'Date', value: expiryDate }, { name: 'Amount', value: (subscription.priceRialSnapshot / 10n).toString() }, linkParameter];
    }
    if (templateCode === 'SUBSCRIPTION_RENEWAL_7_DAYS') return [{ name: 'Date', value: expiryDate }, linkParameter];
    if (templateCode === 'SUBSCRIPTION_EXPIRED') return [{ name: 'Date', value: this.formatDate(subscription.graceEndsAt) }, linkParameter];
    if (['SUBSCRIPTION_TRIAL_7_DAYS', 'SUBSCRIPTION_TRIAL_3_DAYS', 'SUBSCRIPTION_TRIAL_1_DAY'].includes(templateCode)) {
      return [{ name: 'Date', value: expiryDate }, linkParameter];
    }
    return [linkParameter];
  }

  private formatDate(date: Date | null): string {
    return date
      ? new Intl.DateTimeFormat('fa-IR-u-ca-persian', { dateStyle: 'short', timeZone: 'Asia/Tehran' }).format(date)
      : '';
  }

  private isWithinDeliveryWindow(now: Date, policy: SubscriptionPolicySettings['sms']): boolean {
    const hour = Number(new Intl.DateTimeFormat('en-US', {
      timeZone: policy.timezone,
      hour: '2-digit',
      hourCycle: 'h23',
    }).format(now));
    return hour >= policy.startHour && hour < policy.endHour;
  }

  private async failReminder(reminderId: string, failureReason: string): Promise<void> {
    await this.prisma.subscriptionReminder.updateMany({
      where: { id: reminderId, status: { in: ['PENDING', 'SENT'] } },
      data: { status: 'FAILED', sentAt: null, failureReason: failureReason.slice(0, 200) },
    });
  }
}
