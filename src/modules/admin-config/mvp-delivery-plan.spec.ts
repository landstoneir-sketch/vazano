import { getMvpDeliveryPlan } from './mvp-delivery-plan';

describe('MVP delivery plan', () => {
  it('keeps milestone weights complete and reports the current comparison', () => {
    const result = getMvpDeliveryPlan();
    expect(result.phases.reduce((total, phase) => total + phase.weight, 0)).toBe(100);
    expect(result).toMatchObject({ actualPercent: 88, plannedPercent: 87, previousPercent: 87, changeFromPrevious: 1, varianceFromPlan: 1 });
  });

  it('publishes bounded working-day estimates for owner reporting', () => {
    const result = getMvpDeliveryPlan();
    expect(result.estimates.pilot.minWorkingDays).toBeLessThanOrEqual(result.estimates.pilot.maxWorkingDays);
    expect(result.estimates.release.minWorkingDays).toBeLessThanOrEqual(result.estimates.release.maxWorkingDays);
  });
});
