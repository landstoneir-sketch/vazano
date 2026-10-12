import type { SubscriptionStatus } from '@prisma/client';

export const RENEWAL_WARNING_OFFSETS_DAYS = [-14, -7, -3, 0, 7] as const;
export const TRIAL_WARNING_OFFSETS_DAYS = [-7, -3, -1, 0] as const;
export const SUBSCRIPTION_GRACE_PERIOD_DAYS = 7;

export function resolveSubscriptionStatus(
  persistedStatus: SubscriptionStatus,
  now: Date,
  expiresAt: Date | null,
  graceEndsAt: Date | null,
): SubscriptionStatus {
  if (persistedStatus === 'SUSPENDED' || persistedStatus === 'CANCELLED' || !expiresAt) return persistedStatus;
  if (now < expiresAt) return 'ACTIVE';
  if (graceEndsAt && now < graceEndsAt) return 'GRACE';
  return 'EXPIRED';
}

export function buildRenewalReminderSchedule(expiresAt: Date): Array<{ offsetDays: number; scheduledAt: Date }> {
  return RENEWAL_WARNING_OFFSETS_DAYS.map((offsetDays) => ({
    offsetDays,
    scheduledAt: new Date(expiresAt.getTime() + offsetDays * 24 * 60 * 60 * 1000),
  }));
}

export function buildTrialReminderSchedule(expiresAt: Date): Array<{ offsetDays: number; scheduledAt: Date }> {
  return TRIAL_WARNING_OFFSETS_DAYS.map((offsetDays) => ({
    offsetDays,
    scheduledAt: new Date(expiresAt.getTime() + offsetDays * 24 * 60 * 60 * 1000),
  }));
}

export function addBillingPeriod(start: Date, durationIso: string): Date {
  const result = new Date(start);
  const trialDays = durationIso.match(/^P([1-9]|[1-8][0-9]|90)D$/);
  if (trialDays) result.setUTCDate(result.getUTCDate() + Number(trialDays[1]));
  else if (durationIso === 'P1M') result.setUTCMonth(result.getUTCMonth() + 1);
  else if (durationIso === 'P3M') result.setUTCMonth(result.getUTCMonth() + 3);
  else if (durationIso === 'P6M') result.setUTCMonth(result.getUTCMonth() + 6);
  else if (durationIso === 'P1Y') result.setUTCFullYear(result.getUTCFullYear() + 1);
  else throw new RangeError('Unsupported subscription duration');
  return result;
}
