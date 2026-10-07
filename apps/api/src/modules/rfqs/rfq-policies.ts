export const QUALITY_CONTROL_FEE_BPS = 300;
export const BUYER_COMMITMENT_AMOUNT_RIAL = 2_500_000n;
export const BUYER_COMMITMENT_POLICY_VERSION = 'BUYER_PRICE_V1_0';

export function calculateQualityControlFeeRial(purchaseAmountRial: bigint, feeBps = QUALITY_CONTROL_FEE_BPS): bigint {
  if (purchaseAmountRial < 0n) throw new RangeError('purchaseAmountRial must be non-negative');
  if (!Number.isInteger(feeBps) || feeBps < 0 || feeBps > 10_000) throw new RangeError('feeBps must be an integer between 0 and 10000');
  return (purchaseAmountRial * BigInt(feeBps)) / 10_000n;
}

export function canPublishRfq(approvalStatus: string, commitmentStatus: string): boolean {
  return approvalStatus === 'APPROVED' && (commitmentStatus === 'NOT_REQUIRED' || commitmentStatus === 'HELD');
}
