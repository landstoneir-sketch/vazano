import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../shared/prisma/prisma.service';

export const SUPPORTED_RENEWAL_OFFSETS = [-14, -7, -3, 0, 7] as const;
export const SUPPORTED_TRIAL_OFFSETS = [-7, -3, -1, 0] as const;

export type SubscriptionPolicySettings = {
  gracePeriodDays: number;
  renewalWarningOffsetsDays: number[];
  trialWarningOffsetsDays: number[];
  sms: {
    startHour: number;
    endHour: number;
    timezone: string;
    renewalMaxPer24Hours: number;
  };
  foundingProgram: {
    enabled: boolean;
    planCode: string;
    capacity: number;
    renewalDiscountBps: number;
    minimumValidLeads: number;
    guaranteeExtensionDays: number;
    managedSalesOnly: boolean;
  };
};

const DEFAULT_POLICY: SubscriptionPolicySettings = {
  gracePeriodDays: 7,
  renewalWarningOffsetsDays: [...SUPPORTED_RENEWAL_OFFSETS],
  trialWarningOffsetsDays: [...SUPPORTED_TRIAL_OFFSETS],
  sms: { startHour: 9, endHour: 20, timezone: 'Asia/Tehran', renewalMaxPer24Hours: 1 },
  foundingProgram: {
    enabled: true,
    planCode: 'SELLER_FOUNDING_P6M_V1',
    capacity: 20,
    renewalDiscountBps: 2000,
    minimumValidLeads: 10,
    guaranteeExtensionDays: 90,
    managedSalesOnly: true,
  },
};

const POLICY_KEYS = [
  'subscription.grace_period_days',
  'subscription.renewal_warning_offsets_days',
  'subscription.trial_warning_offsets_days',
  'notification.sms.send_window_local',
  'notification.sms.renewal_max_per_24h',
  'subscription.founding_program',
] as const;

@Injectable()
export class SubscriptionPolicySettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async get(): Promise<SubscriptionPolicySettings> {
    const rows = await this.prisma.systemSetting.findMany({
      where: { key: { in: [...POLICY_KEYS] } },
      select: { key: true, value: true },
    });
    return resolveSubscriptionPolicySettings(Object.fromEntries(rows.map((row) => [row.key, row.value])));
  }
}

export function resolveSubscriptionPolicySettings(values: Record<string, unknown>): SubscriptionPolicySettings {
  const gracePeriodDays = values['subscription.grace_period_days'] ?? DEFAULT_POLICY.gracePeriodDays;
  const renewalOffsets = values['subscription.renewal_warning_offsets_days'] ?? DEFAULT_POLICY.renewalWarningOffsetsDays;
  const trialOffsets = values['subscription.trial_warning_offsets_days'] ?? DEFAULT_POLICY.trialWarningOffsetsDays;
  const sendWindow = values['notification.sms.send_window_local'] ?? DEFAULT_POLICY.sms;
  const renewalMax = values['notification.sms.renewal_max_per_24h'] ?? DEFAULT_POLICY.sms.renewalMaxPer24Hours;
  const foundingProgram = values['subscription.founding_program'] ?? DEFAULT_POLICY.foundingProgram;

  assertValidSubscriptionPolicySetting('subscription.grace_period_days', gracePeriodDays);
  assertValidSubscriptionPolicySetting('subscription.renewal_warning_offsets_days', renewalOffsets);
  assertValidSubscriptionPolicySetting('subscription.trial_warning_offsets_days', trialOffsets);
  assertValidSubscriptionPolicySetting('notification.sms.send_window_local', sendWindow);
  assertValidSubscriptionPolicySetting('notification.sms.renewal_max_per_24h', renewalMax);
  assertValidSubscriptionPolicySetting('subscription.founding_program', foundingProgram);

  const window = sendWindow as { startHour: number; endHour: number; timezone: string };
  const founding = foundingProgram as SubscriptionPolicySettings['foundingProgram'];
  return {
    gracePeriodDays: gracePeriodDays as number,
    renewalWarningOffsetsDays: [...renewalOffsets as number[]].sort((a, b) => a - b),
    trialWarningOffsetsDays: [...trialOffsets as number[]].sort((a, b) => a - b),
    sms: {
      startHour: window.startHour,
      endHour: window.endHour,
      timezone: window.timezone,
      renewalMaxPer24Hours: renewalMax as number,
    },
    foundingProgram: { ...founding },
  };
}

export function assertValidSubscriptionPolicySetting(key: string, value: unknown): void {
  if (key === 'subscription.grace_period_days') {
    if (!Number.isInteger(value) || (value as number) < 0 || (value as number) > 30) {
      throw new RangeError('مهلت تنفس باید عددی صحیح بین صفر تا ۳۰ روز باشد.');
    }
    return;
  }
  if (key === 'subscription.renewal_warning_offsets_days') {
    assertSupportedOffsets(value, SUPPORTED_RENEWAL_OFFSETS, 'اخطارهای تمدید');
    return;
  }
  if (key === 'subscription.trial_warning_offsets_days') {
    assertSupportedOffsets(value, SUPPORTED_TRIAL_OFFSETS, 'اخطارهای دوره آزمایشی');
    return;
  }
  if (key === 'notification.sms.renewal_max_per_24h') {
    if (!Number.isInteger(value) || (value as number) < 1 || (value as number) > 10) {
      throw new RangeError('حداکثر پیامک تمدید باید عددی صحیح بین ۱ تا ۱۰ باشد.');
    }
    return;
  }
  if (key === 'notification.sms.send_window_local') {
    if (!isRecord(value)) throw new RangeError('بازه ارسال پیامک باید یک مقدار JSON معتبر باشد.');
    const { startHour, endHour, timezone } = value;
    if (!Number.isInteger(startHour) || !Number.isInteger(endHour)
      || (startHour as number) < 0 || (endHour as number) > 24 || (startHour as number) >= (endHour as number)) {
      throw new RangeError('ساعت شروع و پایان پیامک باید یک بازه معتبر بین صفر تا ۲۴ باشد.');
    }
    if (typeof timezone !== 'string' || !isValidTimeZone(timezone)) {
      throw new RangeError('منطقه زمانی ارسال پیامک معتبر نیست.');
    }
    return;
  }
  if (key === 'subscription.founding_program') {
    if (!isRecord(value)
      || typeof value.enabled !== 'boolean'
      || typeof value.managedSalesOnly !== 'boolean'
      || typeof value.planCode !== 'string'
      || !/^[A-Z0-9_]{3,64}$/.test(value.planCode)
      || !isIntegerBetween(value.capacity, 1, 1_000)
      || !isIntegerBetween(value.renewalDiscountBps, 0, 9_000)
      || !isIntegerBetween(value.minimumValidLeads, 0, 100_000)
      || !isIntegerBetween(value.guaranteeExtensionDays, 0, 365)) {
      throw new RangeError('تنظیمات برنامه کارخانه‌های مؤسس معتبر نیست.');
    }
  }
}

function assertSupportedOffsets(value: unknown, supported: readonly number[], label: string): void {
  if (!Array.isArray(value) || value.length === 0
    || !value.every((item: unknown) => typeof item === 'number' && Number.isInteger(item) && supported.includes(item))) {
    throw new RangeError(`${label} فقط می‌تواند شامل مقادیر ${supported.join('، ')} باشد.`);
  }
  if (new Set(value).size !== value.length || !value.includes(0)) {
    throw new RangeError(`${label} نباید مقدار تکراری داشته باشد و باید روز پایان را شامل شود.`);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isIntegerBetween(value: unknown, minimum: number, maximum: number): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= minimum && value <= maximum;
}

function isValidTimeZone(timezone: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: timezone }).format();
    return true;
  }
  catch {
    return false;
  }
}
