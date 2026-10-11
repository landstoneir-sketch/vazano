import { resolvePaymentReconciliationStatus } from './payment-reconciliation-policy';

describe('payment reconciliation policy', () => {
  it('marks matching successful states as reconciled', () => {
    expect(resolvePaymentReconciliationStatus('SUCCEEDED', true)).toBe('MATCHED');
  });

  it('requires action when provider and local state disagree', () => {
    expect(resolvePaymentReconciliationStatus('FAILED', true)).toBe('ACTION_REQUIRED');
    expect(resolvePaymentReconciliationStatus('SUCCEEDED', false)).toBe('ACTION_REQUIRED');
  });

  it('keeps an unconfirmed failed or pending payment out of the matched ledger', () => {
    expect(resolvePaymentReconciliationStatus('FAILED', false)).toBe('PROVIDER_UNCONFIRMED');
    expect(resolvePaymentReconciliationStatus('REDIRECT_PENDING', false)).toBe('PROVIDER_UNCONFIRMED');
  });
});
