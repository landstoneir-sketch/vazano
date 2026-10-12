import type { SubscriptionDiscountType } from '@prisma/client';

export type SubscriptionDiscountInput = {
  type: SubscriptionDiscountType;
  percentageBps: number | null;
  fixedAmountRial: bigint | null;
};

export function calculateSubscriptionDiscount(priceRial: bigint, discount: SubscriptionDiscountInput): bigint {
  if (priceRial <= 0n) throw new Error('قیمت پلن باید بیشتر از صفر باشد.');
  const amount = discount.type === 'PERCENTAGE'
    ? (priceRial * BigInt(discount.percentageBps ?? 0)) / 10_000n
    : (discount.fixedAmountRial ?? 0n);
  if (amount <= 0n) throw new Error('مقدار تخفیف معتبر نیست.');
  if (amount >= priceRial) throw new Error('کد تخفیف نمی‌تواند مبلغ قابل پرداخت را صفر کند.');
  return amount;
}
