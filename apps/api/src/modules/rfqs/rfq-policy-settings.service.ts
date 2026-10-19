import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { BUYER_COMMITMENT_AMOUNT_RIAL, BUYER_COMMITMENT_POLICY_VERSION, QUALITY_CONTROL_FEE_BPS } from './rfq-policies';

export type RfqPolicySettings = {
  marketCountry: string;
  marketCoverageMode: 'NATIONWIDE' | 'SELECTED_PROVINCES';
  marketCoverageProvinceCodes: string[];
  displayPricesTaxInclusive: boolean;
  legalRole: 'INFORMATION_INTERMEDIARY' | 'MARKETPLACE_OPERATOR' | 'CONTRACTING_AGENT';
  qualityControl: { enabled: boolean; feeBps: number };
  operatorEntryEnabled: boolean;
  pilotManualReview: boolean;
  buyerCommitment: { amountRial: bigint; policyVersion: string };
};

const DEFAULT_POLICY: RfqPolicySettings = {
  marketCountry: 'IR',
  marketCoverageMode: 'NATIONWIDE',
  marketCoverageProvinceCodes: [],
  displayPricesTaxInclusive: false,
  legalRole: 'INFORMATION_INTERMEDIARY',
  qualityControl: { enabled: true, feeBps: QUALITY_CONTROL_FEE_BPS },
  operatorEntryEnabled: true,
  pilotManualReview: true,
  buyerCommitment: { amountRial: BUYER_COMMITMENT_AMOUNT_RIAL, policyVersion: BUYER_COMMITMENT_POLICY_VERSION },
};

const POLICY_KEYS = [
  'market.coverage.country',
  'market.coverage.mode',
  'market.coverage.province_codes',
  'pricing.display_tax_inclusive',
  'platform.legal_role',
  'quality_control.enabled',
  'quality_control.fee_bps',
  'rfq.operator_entry_enabled',
  'rfq.pilot_manual_review',
  'rfq.buyer_commitment_amount_rial',
  'rfq.buyer_commitment_policy_version',
] as const;

@Injectable()
export class RfqPolicySettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async get(): Promise<RfqPolicySettings> {
    const rows = await this.prisma.systemSetting.findMany({
      where: { key: { in: [...POLICY_KEYS] } },
      select: { key: true, value: true },
    });
    return resolveRfqPolicySettings(Object.fromEntries(rows.map((row) => [row.key, row.value])));
  }
}

export function resolveRfqPolicySettings(values: Record<string, unknown>): RfqPolicySettings {
  const merged = {
    marketCountry: values['market.coverage.country'] ?? DEFAULT_POLICY.marketCountry,
    marketCoverageMode: values['market.coverage.mode'] ?? DEFAULT_POLICY.marketCoverageMode,
    marketCoverageProvinceCodes: values['market.coverage.province_codes'] ?? DEFAULT_POLICY.marketCoverageProvinceCodes,
    displayPricesTaxInclusive: values['pricing.display_tax_inclusive'] ?? DEFAULT_POLICY.displayPricesTaxInclusive,
    legalRole: values['platform.legal_role'] ?? DEFAULT_POLICY.legalRole,
    qualityControlEnabled: values['quality_control.enabled'] ?? DEFAULT_POLICY.qualityControl.enabled,
    qualityControlFeeBps: values['quality_control.fee_bps'] ?? DEFAULT_POLICY.qualityControl.feeBps,
    operatorEntryEnabled: values['rfq.operator_entry_enabled'] ?? DEFAULT_POLICY.operatorEntryEnabled,
    pilotManualReview: values['rfq.pilot_manual_review'] ?? DEFAULT_POLICY.pilotManualReview,
    buyerCommitmentAmountRial: values['rfq.buyer_commitment_amount_rial'] ?? Number(DEFAULT_POLICY.buyerCommitment.amountRial),
    buyerCommitmentPolicyVersion: values['rfq.buyer_commitment_policy_version'] ?? DEFAULT_POLICY.buyerCommitment.policyVersion,
  };
  for (const [key, value] of Object.entries(values)) assertValidRfqPolicySetting(key, value);
  assertValidRfqPolicySetting('market.coverage.country', merged.marketCountry);
  assertValidRfqPolicySetting('market.coverage.mode', merged.marketCoverageMode);
  assertValidRfqPolicySetting('market.coverage.province_codes', merged.marketCoverageProvinceCodes);
  assertValidRfqPolicySetting('pricing.display_tax_inclusive', merged.displayPricesTaxInclusive);
  assertValidRfqPolicySetting('platform.legal_role', merged.legalRole);
  assertValidRfqPolicySetting('quality_control.enabled', merged.qualityControlEnabled);
  assertValidRfqPolicySetting('quality_control.fee_bps', merged.qualityControlFeeBps);
  assertValidRfqPolicySetting('rfq.operator_entry_enabled', merged.operatorEntryEnabled);
  assertValidRfqPolicySetting('rfq.pilot_manual_review', merged.pilotManualReview);
  assertValidRfqPolicySetting('rfq.buyer_commitment_amount_rial', merged.buyerCommitmentAmountRial);
  assertValidRfqPolicySetting('rfq.buyer_commitment_policy_version', merged.buyerCommitmentPolicyVersion);
  if (merged.marketCoverageMode === 'SELECTED_PROVINCES' && (merged.marketCoverageProvinceCodes as string[]).length === 0) {
    throw new RangeError('برای پوشش استان‌های منتخب باید حداقل یک استان انتخاب شود.');
  }
  return {
    marketCountry: merged.marketCountry as string,
    marketCoverageMode: merged.marketCoverageMode as RfqPolicySettings['marketCoverageMode'],
    marketCoverageProvinceCodes: merged.marketCoverageProvinceCodes as string[],
    displayPricesTaxInclusive: merged.displayPricesTaxInclusive as boolean,
    legalRole: merged.legalRole as RfqPolicySettings['legalRole'],
    qualityControl: { enabled: merged.qualityControlEnabled as boolean, feeBps: merged.qualityControlFeeBps as number },
    operatorEntryEnabled: merged.operatorEntryEnabled as boolean,
    pilotManualReview: merged.pilotManualReview as boolean,
    buyerCommitment: {
      amountRial: BigInt(merged.buyerCommitmentAmountRial as number),
      policyVersion: merged.buyerCommitmentPolicyVersion as string,
    },
  };
}

export function assertValidRfqPolicySetting(key: string, value: unknown): void {
  if (key === 'market.coverage.country') {
    if (typeof value !== 'string' || !/^[A-Z]{2}$/.test(value)) throw new RangeError('کد کشور باید دو حرف بزرگ لاتین باشد.');
  }
  else if (key === 'market.coverage.mode') {
    if (!['NATIONWIDE', 'SELECTED_PROVINCES'].includes(String(value))) throw new RangeError('نوع پوشش جغرافیایی معتبر نیست.');
  }
  else if (key === 'market.coverage.province_codes') {
    if (!Array.isArray(value) || value.length > 31 || value.some((code) => typeof code !== 'string' || !/^[a-z][a-z0-9-]{1,63}$/.test(code))) {
      throw new RangeError('فهرست استان‌های منتخب معتبر نیست.');
    }
    if (new Set(value).size !== value.length) throw new RangeError('استان تکراری در پوشش بازار مجاز نیست.');
  }
  else if (key === 'platform.legal_role') {
    if (!['INFORMATION_INTERMEDIARY', 'MARKETPLACE_OPERATOR', 'CONTRACTING_AGENT'].includes(String(value))) throw new RangeError('نقش حقوقی پلتفرم معتبر نیست.');
  }
  else if (['pricing.display_tax_inclusive', 'quality_control.enabled', 'rfq.operator_entry_enabled', 'rfq.pilot_manual_review'].includes(key)) {
    if (typeof value !== 'boolean') throw new RangeError('مقدار این تنظیم باید فعال یا غیرفعال باشد.');
  }
  else if (key === 'quality_control.fee_bps') {
    if (!Number.isInteger(value) || (value as number) < 0 || (value as number) > 10_000) throw new RangeError('کارمزد کنترل کیفیت باید بین صفر تا ۱۰۰ درصد باشد.');
  }
  else if (key === 'rfq.buyer_commitment_amount_rial') {
    if (!Number.isSafeInteger(value) || (value as number) < 0 || (value as number) > 10_000_000_000_000) throw new RangeError('مبلغ تعهد خریدار معتبر نیست.');
  }
  else if (key === 'rfq.buyer_commitment_policy_version') {
    if (typeof value !== 'string' || !/^[A-Z0-9_]{3,64}$/.test(value)) throw new RangeError('نسخه سیاست تعهد خریدار معتبر نیست.');
  }
}

export function isProvinceWithinMarketCoverage(policy: RfqPolicySettings, provinceCode: string | undefined): boolean {
  if (policy.marketCoverageMode === 'NATIONWIDE') return true;
  return Boolean(provinceCode && policy.marketCoverageProvinceCodes.includes(provinceCode));
}
