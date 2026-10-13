import { assertValidRfqPolicySetting, isProvinceWithinMarketCoverage, resolveRfqPolicySettings } from './rfq-policy-settings.service';

describe('RFQ policy settings', () => {
  it('uses approved MVP defaults', () => {
    expect(resolveRfqPolicySettings({})).toEqual({
      marketCountry: 'IR', marketCoverageMode: 'NATIONWIDE', marketCoverageProvinceCodes: [], displayPricesTaxInclusive: false,
      legalRole: 'INFORMATION_INTERMEDIARY', qualityControl: { enabled: true, feeBps: 300 },
      operatorEntryEnabled: true, pilotManualReview: true,
      buyerCommitment: { amountRial: 2_500_000n, policyVersion: 'BUYER_PRICE_V1_0' },
    });
  });

  it('accepts safe administrator changes', () => {
    expect(resolveRfqPolicySettings({
      'quality_control.enabled': false,
      'quality_control.fee_bps': 250,
      'rfq.pilot_manual_review': false,
      'rfq.buyer_commitment_amount_rial': 5_000_000,
    })).toMatchObject({ qualityControl: { enabled: false, feeBps: 250 }, pilotManualReview: false });
  });

  it('rejects invalid money and percentage values', () => {
    expect(() => assertValidRfqPolicySetting('quality_control.fee_bps', 10_001)).toThrow();
    expect(() => assertValidRfqPolicySetting('rfq.buyer_commitment_amount_rial', -1)).toThrow();
  });

  it('requires an allowlist when selected-province coverage is enabled', () => {
    expect(() => resolveRfqPolicySettings({ 'market.coverage.mode': 'SELECTED_PROVINCES' })).toThrow();
    const policy = resolveRfqPolicySettings({
      'market.coverage.mode': 'SELECTED_PROVINCES',
      'market.coverage.province_codes': ['tehran', 'alborz'],
    });
    expect(policy.marketCoverageProvinceCodes).toEqual(['tehran', 'alborz']);
    expect(isProvinceWithinMarketCoverage(policy, 'tehran')).toBe(true);
    expect(isProvinceWithinMarketCoverage(policy, 'fars')).toBe(false);
  });
});
