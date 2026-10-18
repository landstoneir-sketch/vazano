import { getMvpDeliveryPlan } from './mvp-delivery-plan';

describe('MVP delivery plan', () => {
  it('keeps milestone weights complete and reports the current comparison', () => {
    const result = getMvpDeliveryPlan();
    expect(result.phases.reduce((total, phase) => total + phase.weight, 0)).toBe(100);
    expect(result).toMatchObject({ snapshotDate: '2026-10-18', actualPercent: 97, plannedPercent: 91, previousPercent: 97, changeFromPrevious: 0, varianceFromPlan: 6 });
    expect(result.phases.find((phase) => phase.key === 'quotations-collaboration')).toMatchObject({
      previousPercent: 96,
      actualPercent: 96,
      changeFromPrevious: 0,
      variance: 6,
    });
    expect(result.phases.find((phase) => phase.key === 'marketplace-core')).toMatchObject({ previousPercent: 97, actualPercent: 97, changeFromPrevious: 0 });
    expect(result.phases.find((phase) => phase.key === 'commercial-foundation')).toMatchObject({ previousPercent: 85, actualPercent: 88, changeFromPrevious: 3 });
    expect(result.phases.find((phase) => phase.key === 'admin-operations')).toMatchObject({ previousPercent: 92, actualPercent: 92, changeFromPrevious: 0 });
    expect(result.phases.find((phase) => phase.key === 'quality-release')).toMatchObject({ previousPercent: 98, actualPercent: 99, changeFromPrevious: 1 });
  });

  it('publishes bounded working-day estimates for owner reporting', () => {
    const result = getMvpDeliveryPlan();
    expect(result.estimates.pilot.minWorkingDays).toBeLessThanOrEqual(result.estimates.pilot.maxWorkingDays);
    expect(result.estimates.release.minWorkingDays).toBeLessThanOrEqual(result.estimates.release.maxWorkingDays);
  });
});
