import {
  assertValidSubscriptionPolicySetting,
  resolveSubscriptionPolicySettings,
} from './subscription-policy-settings.service';

describe('subscription policy settings', () => {
  it('uses the approved MVP defaults', () => {
    expect(resolveSubscriptionPolicySettings({})).toEqual({
      gracePeriodDays: 7,
      renewalWarningOffsetsDays: [-14, -7, -3, 0, 7],
      trialWarningOffsetsDays: [-7, -3, -1, 0],
      sms: { startHour: 9, endHour: 20, timezone: 'Asia/Tehran', renewalMaxPer24Hours: 1 },
      foundingProgram: {
        enabled: true, planCode: 'SELLER_FOUNDING_P6M_V1', capacity: 20, renewalDiscountBps: 2000,
        minimumValidLeads: 10, guaranteeExtensionDays: 90, managedSalesOnly: true,
      },
    });
  });

  it('accepts supported administrator changes', () => {
    expect(resolveSubscriptionPolicySettings({
      'subscription.grace_period_days': 10,
      'subscription.renewal_warning_offsets_days': [-7, -3, 0],
      'subscription.trial_warning_offsets_days': [-3, -1, 0],
      'notification.sms.send_window_local': { startHour: 10, endHour: 19, timezone: 'Asia/Tehran' },
      'notification.sms.renewal_max_per_24h': 2,
    })).toMatchObject({ gracePeriodDays: 10, renewalWarningOffsetsDays: [-7, -3, 0] });
  });

  it('rejects unsupported reminders and unsafe delivery windows', () => {
    expect(() => assertValidSubscriptionPolicySetting('subscription.renewal_warning_offsets_days', [-10, 0])).toThrow();
    expect(() => assertValidSubscriptionPolicySetting('notification.sms.send_window_local', { startHour: 20, endHour: 9, timezone: 'Asia/Tehran' })).toThrow();
  });

  it('validates the managed founding program configuration', () => {
    expect(() => assertValidSubscriptionPolicySetting('subscription.founding_program', {
      enabled: true, planCode: 'SELLER_FOUNDING_P6M_V1', capacity: 20,
      renewalDiscountBps: 2000, minimumValidLeads: 10, guaranteeExtensionDays: 90, managedSalesOnly: true,
    })).not.toThrow();
    expect(() => assertValidSubscriptionPolicySetting('subscription.founding_program', {
      enabled: true, capacity: 0,
    })).toThrow();
  });
});
