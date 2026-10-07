import { calculateQualityControlFeeRial, canPublishRfq } from './rfq-policies';

describe('RFQ policies', () => {
  it('calculates the approved 3% quality-control fee using integer Rial amounts', () => {
    expect(calculateQualityControlFeeRial(1_000_000_000n)).toBe(30_000_000n);
  });

  it('rejects invalid basis-point values', () => {
    expect(() => calculateQualityControlFeeRial(10n, 10_001)).toThrow(RangeError);
  });

  it('keeps approval and buyer commitment as independent publication gates', () => {
    expect(canPublishRfq('APPROVED', 'REQUIRED')).toBe(false);
    expect(canPublishRfq('PENDING', 'HELD')).toBe(false);
    expect(canPublishRfq('APPROVED', 'HELD')).toBe(true);
    expect(canPublishRfq('APPROVED', 'NOT_REQUIRED')).toBe(true);
  });
});
