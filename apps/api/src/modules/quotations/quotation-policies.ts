import { Prisma } from '@prisma/client';

export type ProposalFeePolicy = {
  version: string;
  rate: string;
  minToman: number;
  maxToman: number;
  refundFractionIfEligible: string;
};

export const DEFAULT_PROPOSAL_FEE_POLICY: ProposalFeePolicy = {
  version: '1.2',
  rate: '0.001',
  minToman: 100_000,
  maxToman: 5_000_000,
  refundFractionIfEligible: '2/3',
};

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

export function calculateProposalFeeCredits(finalAmountRial: bigint, policy = DEFAULT_PROPOSAL_FEE_POLICY): bigint {
  const { numerator, scale } = decimalFraction(policy.rate);
  const denominator = 10n * scale;
  const variableFee = (finalAmountRial * numerator + denominator - 1n) / denominator;
  const minimum = BigInt(policy.minToman);
  const maximum = BigInt(policy.maxToman);
  if (variableFee < minimum) return minimum;
  if (variableFee > maximum) return maximum;
  return variableFee;
}

export function calculateProposalRefundCredits(feeCredits: bigint, fraction: string): bigint {
  const match = /^(\d+)\/([1-9]\d*)$/.exec(fraction);
  if (!match) throw new RangeError('Proposal refund fraction is invalid.');
  const numerator = BigInt(match[1]!);
  const denominator = BigInt(match[2]!);
  if (numerator > denominator) throw new RangeError('Proposal refund fraction exceeds one.');
  return feeCredits * numerator / denominator;
}

export function resolveProposalFeePolicy(value: unknown): ProposalFeePolicy {
  if (value === undefined || value === null) return DEFAULT_PROPOSAL_FEE_POLICY;
  assertValidProposalFeePolicy(value);
  return value as ProposalFeePolicy;
}

export function assertValidProposalFeePolicy(value: unknown): void {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new RangeError('سیاست هزینه ارسال پیشنهاد معتبر نیست.');
  }
  const policy = value as Record<string, unknown>;
  if (typeof policy.version !== 'string' || !/^[A-Z0-9._-]{1,32}$/i.test(policy.version)) {
    throw new RangeError('نسخه سیاست هزینه پیشنهاد معتبر نیست.');
  }
  if (typeof policy.rate !== 'string' || !/^0(?:\.\d{1,6})?$|^1(?:\.0{1,6})?$/.test(policy.rate)) {
    throw new RangeError('نرخ هزینه پیشنهاد باید عددی بین صفر و یک با حداکثر شش رقم اعشار باشد.');
  }
  if (!Number.isSafeInteger(policy.minToman) || !Number.isSafeInteger(policy.maxToman)) {
    throw new RangeError('حداقل و حداکثر هزینه پیشنهاد باید عدد صحیح تومان باشد.');
  }
  const minimum = policy.minToman as number;
  const maximum = policy.maxToman as number;
  if (minimum < 0 || maximum < minimum || maximum > 1_000_000_000) {
    throw new RangeError('بازه هزینه پیشنهاد معتبر نیست.');
  }
  if (typeof policy.refundFractionIfEligible !== 'string' || !/^[0-9]+\/[1-9][0-9]*$/.test(policy.refundFractionIfEligible)) {
    throw new RangeError('نسبت بازگشت اعتبار باید مانند ۲/۳ وارد شود.');
  }
  const [refundNumerator, refundDenominator] = policy.refundFractionIfEligible.split('/').map(Number);
  if (refundNumerator! > refundDenominator!) throw new RangeError('نسبت بازگشت اعتبار نمی‌تواند بیشتر از یک باشد.');
}

function decimalFraction(value: string): { numerator: bigint; scale: bigint } {
  const [integerPart = '0', fractionPart = ''] = value.split('.');
  const scale = 10n ** BigInt(fractionPart.length);
  return { numerator: BigInt(integerPart) * scale + BigInt(fractionPart || '0'), scale };
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
