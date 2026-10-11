import { buildPaymentReceiptSnapshot } from './payment-receipt-policy';

describe('payment receipt policy', () => {
  it('builds a stable tax-exclusive Rial receipt', () => {
    const paidAt = new Date('2026-10-11T08:00:00.000Z');
    expect(buildPaymentReceiptSnapshot('payment-123', 30_000_000n, paidAt)).toEqual({
      receiptNumber: 'VZ-2026-PAYMENT-123',
      amountRial: 30_000_000n,
      taxRial: 0n,
      currency: 'IRR',
      paidAt,
    });
  });

  it('rejects invalid receipt inputs', () => {
    expect(() => buildPaymentReceiptSnapshot('', 1n, new Date())).toThrow(RangeError);
    expect(() => buildPaymentReceiptSnapshot('payment-123', 0n, new Date())).toThrow(RangeError);
    expect(() => buildPaymentReceiptSnapshot('payment-123', 1n, new Date('invalid'))).toThrow(RangeError);
  });
});
