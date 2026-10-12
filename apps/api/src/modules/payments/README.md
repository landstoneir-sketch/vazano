# Payments module

This module provides the payment-provider abstraction, Zarinpal and mock adapters, payment verification policies, reconciliation helpers, and immutable payment receipts.

- Redirect or callback data is never accepted as proof of payment without server-side provider verification.
- Amounts are stored as integer Rial values; user interfaces may display Toman.
- Idempotency prevents repeated callbacks from activating a service or issuing a receipt twice.
- Provider credentials and SDK details never leak into business modules.
- Manual reconciliation is audited and does not silently change financial or service state.
- The mock provider is forbidden in production.

