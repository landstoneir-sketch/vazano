import { buildBillingInvoiceNumber } from './billing-invoice-policy';

describe('billing invoice policy', () => {
  it('creates a stable non-sensitive invoice number from the subscription id', () => {
    expect(buildBillingInvoiceNumber('subscription-abc123', new Date('2026-10-12T00:00:00Z'))).toBe('VZI-2026-SUBSCRIPTIONABC123');
  });
});
