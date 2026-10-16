import { getMvpDeliveryPlan } from './mvp-delivery-plan';

describe('MVP delivery plan', () => {
  it('keeps milestone weights complete and reports the current comparison', () => {
    const result = getMvpDeliveryPlan();
    expect(result.phases.reduce((total, phase) => total + phase.weight, 0)).toBe(100);
    expect(result).toMatchObject({ actualPercent: 92, plannedPercent: 91, previousPercent: 92, changeFromPrevious: 0, varianceFromPlan: 1 });
    expect(result.phases.find((phase) => phase.key === 'quotations-collaboration')).toMatchObject({
      previousPercent: 90,
      actualPercent: 90,
      changeFromPrevious: 0,
      variance: 0,
    });
    expect(result.phases.find((phase) => phase.key === 'marketplace-core')).toMatchObject({ previousPercent: 93, actualPercent: 93, changeFromPrevious: 0 });
    expect(result.phases.find((phase) => phase.key === 'commercial-foundation')).toMatchObject({ previousPercent: 70, actualPercent: 70, changeFromPrevious: 0 });
    expect(result.phases.find((phase) => phase.key === 'admin-operations')).toMatchObject({ previousPercent: 83, actualPercent: 83, changeFromPrevious: 0 });
    expect(result.phases.find((phase) => phase.key === 'quality-release')).toMatchObject({ previousPercent: 88, actualPercent: 89, changeFromPrevious: 1 });
  });

  it('publishes bounded working-day estimates for owner reporting', () => {
    const result = getMvpDeliveryPlan();
    expect(result.estimates.pilot.minWorkingDays).toBeLessThanOrEqual(result.estimates.pilot.maxWorkingDays);
    expect(result.estimates.release.minWorkingDays).toBeLessThanOrEqual(result.estimates.release.maxWorkingDays);
  });
});
