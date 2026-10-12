import { calculateSubscriptionDiscount } from './subscription-discount-policy';

describe('subscription discount policy', () => {
  it('calculates percentage discounts in basis points without floating point', () => {
    expect(calculateSubscriptionDiscount(1_000_000n, { type: 'PERCENTAGE', percentageBps: 1250, fixedAmountRial: null })).toBe(125_000n);
  });

  it('calculates fixed rial discounts', () => {
    expect(calculateSubscriptionDiscount(1_000_000n, { type: 'FIXED_RIAL', percentageBps: null, fixedAmountRial: 200_000n })).toBe(200_000n);
  });

  it('rejects discounts that make a paid checkout free', () => {
    expect(() => calculateSubscriptionDiscount(1_000_000n, { type: 'FIXED_RIAL', percentageBps: null, fixedAmountRial: 1_000_000n })).toThrow();
  });
});
