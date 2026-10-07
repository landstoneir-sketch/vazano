import { calculateProposalFeeCredits, calculateQuotationTotals, startOfTehranDay } from './quotation-policies';

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
});
