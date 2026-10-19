import { addBillingPeriod, buildRenewalReminderSchedule, buildTrialReminderSchedule, resolveSubscriptionStatus } from './subscription-policies';

describe('subscription policies', () => {
  const expiresAt = new Date('2026-10-10T00:00:00.000Z');
  const graceEndsAt = new Date('2026-10-17T00:00:00.000Z');

  it('applies active, seven-day grace and expired states without deleting history', () => {
    expect(resolveSubscriptionStatus('ACTIVE', new Date('2026-10-09T00:00:00.000Z'), expiresAt, graceEndsAt)).toBe('ACTIVE');
    expect(resolveSubscriptionStatus('ACTIVE', new Date('2026-10-12T00:00:00.000Z'), expiresAt, graceEndsAt)).toBe('GRACE');
    expect(resolveSubscriptionStatus('GRACE', new Date('2026-10-18T00:00:00.000Z'), expiresAt, graceEndsAt)).toBe('EXPIRED');
  });

  it('builds only the approved MVP reminder offsets', () => {
    expect(buildRenewalReminderSchedule(expiresAt).map((item) => item.offsetDays)).toEqual([-14, -7, -3, 0, 7]);
    expect(buildTrialReminderSchedule(expiresAt).map((item) => item.offsetDays)).toEqual([-7, -3, -1, 0]);
  });

  it('uses calendar billing periods instead of fixed day counts', () => {
    expect(addBillingPeriod(new Date('2026-01-15T00:00:00.000Z'), 'P3M').toISOString()).toBe('2026-04-15T00:00:00.000Z');
    expect(addBillingPeriod(new Date('2026-01-15T00:00:00.000Z'), 'P1Y').toISOString()).toBe('2027-01-15T00:00:00.000Z');
    expect(addBillingPeriod(new Date('2026-01-15T00:00:00.000Z'), 'P14D').toISOString()).toBe('2026-01-29T00:00:00.000Z');
  });
});
