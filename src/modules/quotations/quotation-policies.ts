import { Prisma } from '@prisma/client';

export const PROPOSAL_FEE_POLICY_VERSION = '1.2';
export const PROPOSAL_FEE_MIN_CREDITS = 100_000n;
export const PROPOSAL_FEE_MAX_CREDITS = 5_000_000n;

export type QuotationLineInput = {
  quantity: string;
  unitPriceRial: string;
  discountRial?: string;
};

export type QuotationCostInput = {
  items: QuotationLineInput[];
  discountRial?: string;
  taxRial?: string;
  packagingRial?: string;
  loadingRial?: string;
  shippingRial?: string;
  otherCostsRial?: string;
};

export function calculateQuotationTotals(input: QuotationCostInput) {
  const items = input.items.map((item) => {
    const quantity = new Prisma.Decimal(item.quantity);
    const unitPriceRial = BigInt(item.unitPriceRial);
    const discountRial = BigInt(item.discountRial ?? '0');
    const lineSubtotalRial = BigInt(
      quantity.mul(unitPriceRial.toString()).toDecimalPlaces(0, Prisma.Decimal.ROUND_HALF_UP).toFixed(0),
    );
    if (discountRial > lineSubtotalRial) throw new RangeError('Line discount exceeds line subtotal');
    return { quantity, unitPriceRial, discountRial, lineSubtotalRial, lineNetRial: lineSubtotalRial - discountRial };
  });
  const subtotalRial = items.reduce((sum, item) => sum + item.lineNetRial, 0n);
  const discountRial = BigInt(input.discountRial ?? '0');
  if (discountRial > subtotalRial) throw new RangeError('Quotation discount exceeds subtotal');
  const taxRial = BigInt(input.taxRial ?? '0');
  const packagingRial = BigInt(input.packagingRial ?? '0');
  const loadingRial = BigInt(input.loadingRial ?? '0');
  const shippingRial = BigInt(input.shippingRial ?? '0');
  const otherCostsRial = BigInt(input.otherCostsRial ?? '0');
  const finalAmountRial = subtotalRial - discountRial + taxRial + packagingRial + loadingRial + shippingRial + otherCostsRial;
  return { items, subtotalRial, discountRial, taxRial, packagingRial, loadingRial, shippingRial, otherCostsRial, finalAmountRial };
}

export function calculateProposalFeeCredits(finalAmountRial: bigint): bigint {
  const variableFee = (finalAmountRial + 9_999n) / 10_000n;
  if (variableFee < PROPOSAL_FEE_MIN_CREDITS) return PROPOSAL_FEE_MIN_CREDITS;
  if (variableFee > PROPOSAL_FEE_MAX_CREDITS) return PROPOSAL_FEE_MAX_CREDITS;
  return variableFee;
}

export function totalProposalLimitFromEntitlements(entitlements: unknown): number | null {
  if (typeof entitlements !== 'object' || entitlements === null || Array.isArray(entitlements)) return null;
  const value = (entitlements as Record<string, unknown>).totalProposalLimit;
  return Number.isInteger(value) && (value as number) > 0 ? value as number : null;
}

export function effectiveDailyProposalLimit(baseLimit: number, maximumLimit: number, setting: unknown, now: Date): number {
  if (typeof setting !== 'object' || setting === null || Array.isArray(setting)) return baseLimit;
  const value = setting as Record<string, unknown>;
  if (value.enabled !== true || typeof value.expiresAt !== 'string') return baseLimit;
  const expiresAt = new Date(value.expiresAt);
  return Number.isFinite(expiresAt.getTime()) && expiresAt > now ? maximumLimit : baseLimit;
}

export function assertValidShortageOverrideSetting(value: unknown, now = new Date()): void {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new RangeError('تنظیم کمبود عرضه معتبر نیست.');
  }
  const setting = value as Record<string, unknown>;
  if (typeof setting.enabled !== 'boolean' || typeof setting.reason !== 'string' || setting.reason.length > 200) {
    throw new RangeError('وضعیت و دلیل کمبود عرضه معتبر نیست.');
  }
  if (!setting.enabled) {
    if (setting.expiresAt !== null && typeof setting.expiresAt !== 'string') throw new RangeError('زمان پایان معتبر نیست.');
    return;
  }
  const expiresAt = typeof setting.expiresAt === 'string' ? new Date(setting.expiresAt) : null;
  if (setting.reason.trim().length < 5 || !expiresAt || !Number.isFinite(expiresAt.getTime()) || expiresAt <= now) {
    throw new RangeError('فعال‌سازی سقف اضطراری به دلیل حداقل ۵ نویسه و زمان پایان آینده نیاز دارد.');
  }
}

export function startOfTehranDay(now: Date): Date {
  const tehranOffsetMs = 210 * 60 * 1000;
  const local = new Date(now.getTime() + tehranOffsetMs);
  return new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()) - tehranOffsetMs);
}
