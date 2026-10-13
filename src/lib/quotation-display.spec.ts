import { describe, expect, it } from 'vitest';
import { displayedQuotationAmountRial } from './quotation-display';

describe('quotation price display', () => {
  it('removes tax from the primary amount when prices are configured without tax', () => {
    expect(displayedQuotationAmountRial('109000000', '9000000', false)).toBe(BigInt('100000000'));
  });

  it('keeps the final amount when prices are configured tax-inclusive', () => {
    expect(displayedQuotationAmountRial('109000000', '9000000', true)).toBe(BigInt('109000000'));
  });
});
