# Quotations module

This module owns supplier quotation submission, line-level prices and terms, revision rules, buyer comparison, and final supplier selection.

- Only an eligible supplier organization may quote an open and distributed RFQ.
- All monetary calculations are repeated on the server with integer Rial values.
- Submitted quotation revisions preserve history instead of overwriting accepted records.
- Buyer access is restricted to the owning organization; suppliers cannot read competitors' quotations.
- Selection is concurrency-safe, audited, and emits notification events.
- Subscription and proposal-limit policies are enforced in the backend before submission.

