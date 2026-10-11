export type PaymentReceiptSnapshot = {
  receiptNumber: string;
  amountRial: bigint;
  taxRial: bigint;
  currency: 'IRR';
  paidAt: Date;
};

export function buildPaymentReceiptSnapshot(paymentIntentId: string, amountRial: bigint, paidAt: Date): PaymentReceiptSnapshot {
  const normalizedIntentId = paymentIntentId.trim();
  if (!normalizedIntentId) throw new RangeError('Payment intent identifier is required.');
  if (amountRial <= 0n) throw new RangeError('Receipt amount must be greater than zero.');
  if (Number.isNaN(paidAt.getTime())) throw new RangeError('Receipt payment date is invalid.');

  return {
    receiptNumber: `VZ-${paidAt.getUTCFullYear()}-${normalizedIntentId.toUpperCase()}`,
    amountRial,
    taxRial: 0n,
    currency: 'IRR',
    paidAt,
  };
}
