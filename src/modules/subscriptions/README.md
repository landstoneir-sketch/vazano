# Subscriptions module

This module owns seller plan purchase, payment activation, credits, renewal schedules, grace-period transitions, and subscription access state.

- Activation creates the approved MVP reminder schedule at -14, -7, -3, 0, and +7 days.
- Renewal cancels all pending reminders from older subscriptions for the organization.
- A background lifecycle worker moves `ACTIVE → GRACE → EXPIRED` and emits idempotently claimed in-app reminder events.
- SMS reminder rows remain pending until `SUBSCRIPTION_SMS_ENABLED=true` and all nine dedicated SMS.ir renewal/trial template identifiers are configured; OTP template identifiers are never reused for billing messages.
- Approved SMS.ir templates keep `vazano.ir/` literal and receive only the relative `supplier/subscription` path through their `Link` or `Path` parameter.
- Renewal SMS delivery is limited to 09:00–20:00 Asia/Tehran, one message per organization in 24 hours, and the active supplier owner for the MVP. If several reminders are overdue, only the newest one is sent and older reminders are cancelled.
- SMS.ir renewal templates use `Date`, `Amount`, and a provider-approved relative-path parameter named `Link` or `Path`. Provider template identifiers stay in environment configuration and are validated before startup when renewal SMS is enabled.
- Finance managers can inspect reminder delivery status and requeue a failed SMS. Requeueing is audited and never bypasses the delivery window or the 24-hour organization limit.
- Trial plans have a configurable 1–90 day duration, cost zero, no grace period, and can be activated only once per supplier organization. Trial reminders run at -7, -3, -1, and 0 days with dedicated provider templates.
- `/v1/admin/billing/overview` gives finance users a unified view of plans, recent subscriptions, payments, and lifecycle counts.
- Finance users can create plan-scoped or general subscription discount codes with validity windows, total and per-organization limits. Checkout calculates the payable amount only on the backend and reserves redemption until payment is verified.
- Supplier owners can preview an eligible discount before checkout; preview never reserves capacity and checkout always revalidates the code atomically.
- Plan creation and editing require `billing.manage`; historical subscriptions keep price, credit, and plan-version snapshots.
- Stable plan code, billing cycle, and duration are immutable after creation. A materially different commercial offer must be created as a new plan.
- Supplier owners start an idempotent checkout from `/supplier/subscription`; provider SDK details remain behind the payment adapter.
- Paid checkout atomically claims a `CREATED` payment intent before contacting the provider. Concurrent retries return a processing state or the existing redirect and never create a second provider request for the same idempotency key.
- Zarinpal callbacks are verified server-side and redirect to a non-sensitive success/cancel/failure result in the seller workspace.
- The local-only mock provider exposes paid checkout for deterministic E2E testing; production environment validation forbids that provider.
- Successful subscription payments create one immutable Rial receipt with zero tax for the current tax-exclusive MVP policy; repeated callbacks cannot create duplicate activation, credit, or receipt records.
- Cancelled or failed attempts atomically close the draft subscription, invoice, and discount reservation, emit one retry notification event, and require a fresh idempotent checkout request.
- Organization members can view their payment receipts; cross-organization receipt access is rejected in the backend.
- Finance managers can explicitly reconcile a payment against Zarinpal. The result is stored as `MATCHED`, `ACTION_REQUIRED`, or `PROVIDER_UNCONFIRMED` and every check is written to the audit trail; reconciliation never activates a service or changes money state automatically.
- Finance managers can record an offline/manual renewal only for an active supplier and paid plan. The globally unique tracking number, actual Rial amount, payment time, operator, and explanation are retained; activation, credits, reminders, audit, and outbox event are committed atomically without fabricating an online payment intent.
- A tax-exclusive Rial billing invoice is issued when paid-plan checkout starts. Successful provider verification or an audited manual renewal marks its invoice paid; the payment receipt remains separate evidence of the gateway settlement.
