import { assertValidShortageOverrideSetting, calculateProposalFeeCredits, calculateQuotationTotals, effectiveDailyProposalLimit, startOfTehranDay, totalProposalLimitFromEntitlements } from './quotation-policies';

describe('quotation policies', () => {
  it('calculates monetary totals with integer rial values', () => {
    const result = calculateQuotationTotals({
      items: [{ quantity: '12.5', unitPriceRial: '2000000', discountRial: '1000000' }],
      shippingRial: '3000000',
    });
    expect(result.subtotalRial).toBe(24_000_000n);
    expect(result.finalAmountRial).toBe(27_000_000n);
  });

  it('applies the proposal fee floor and cap', () => {
    expect(calculateProposalFeeCredits(100_000_000n)).toBe(100_000n);
    expect(calculateProposalFeeCredits(100_000_000_000n)).toBe(5_000_000n);
  });

  it('uses the Tehran calendar day boundary', () => {
    expect(startOfTehranDay(new Date('2026-10-07T01:00:00.000Z')).toISOString()).toBe('2026-10-06T20:30:00.000Z');
  });

  it('reads a positive total proposal limit from plan entitlements', () => {
    expect(totalProposalLimitFromEntitlements({ totalProposalLimit: 2 })).toBe(2);
    expect(totalProposalLimitFromEntitlements({ totalProposalLimit: 0 })).toBeNull();
    expect(totalProposalLimitFromEntitlements({ totalProposalLimit: '2' })).toBeNull();
  });

  it('applies a time-limited shortage override without exceeding the plan maximum', () => {
    const now = new Date('2026-10-13T10:00:00.000Z');
    const setting = { enabled: true, expiresAt: '2026-10-14T10:00:00.000Z', reason: 'کمبود عرضه در پایلوت' };
    expect(() => assertValidShortageOverrideSetting(setting, now)).not.toThrow();
    expect(effectiveDailyProposalLimit(2, 6, setting, now)).toBe(6);
    expect(effectiveDailyProposalLimit(2, 6, setting, new Date('2026-10-15T10:00:00.000Z'))).toBe(2);
  });

  it('rejects an unbounded shortage override', () => {
    expect(() => assertValidShortageOverrideSetting({ enabled: true, expiresAt: null, reason: 'کمبود عرضه' })).toThrow();
  });
});
