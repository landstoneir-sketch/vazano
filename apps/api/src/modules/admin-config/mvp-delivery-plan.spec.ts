import { getMvpDeliveryPlan } from './mvp-delivery-plan';

describe('MVP delivery plan', () => {
  it('keeps milestone weights complete and reports the current comparison', () => {
    const result = getMvpDeliveryPlan();
    expect(result.phases.reduce((total, phase) => total + phase.weight, 0)).toBe(100);
    expect(result).toMatchObject({ actualPercent: 94, plannedPercent: 91, previousPercent: 93, changeFromPrevious: 1, varianceFromPlan: 3 });
    expect(result.phases.find((phase) => phase.key === 'quotations-collaboration')).toMatchObject({
      previousPercent: 90,
      actualPercent: 90,
      changeFromPrevious: 0,
      variance: 0,
    });
    expect(result.phases.find((phase) => phase.key === 'marketplace-core')).toMatchObject({ previousPercent: 93, actualPercent: 93, changeFromPrevious: 0 });
    expect(result.phases.find((phase) => phase.key === 'commercial-foundation')).toMatchObject({ previousPercent: 82, actualPercent: 83, changeFromPrevious: 1 });
    expect(result.phases.find((phase) => phase.key === 'admin-operations')).toMatchObject({ previousPercent: 87, actualPercent: 88, changeFromPrevious: 1 });
    expect(result.phases.find((phase) => phase.key === 'quality-release')).toMatchObject({ previousPercent: 91, actualPercent: 92, changeFromPrevious: 1 });
  });

  it('publishes bounded working-day estimates for owner reporting', () => {
    const result = getMvpDeliveryPlan();
    expect(result.estimates.pilot.minWorkingDays).toBeLessThanOrEqual(result.estimates.pilot.maxWorkingDays);
    expect(result.estimates.release.minWorkingDays).toBeLessThanOrEqual(result.estimates.release.maxWorkingDays);
  });
});
