# Subscriptions module

This module owns seller plan purchase, payment activation, credits, renewal schedules, grace-period transitions, and subscription access state.

- Activation creates the approved MVP reminder schedule at -14, -7, -3, 0, and +7 days.
- Renewal cancels all pending reminders from older subscriptions for the organization.
- A background lifecycle worker moves `ACTIVE → GRACE → EXPIRED` and emits idempotently claimed in-app reminder events.
- SMS reminder rows remain pending until dedicated SMS.ir renewal-template identifiers are configured; OTP credentials are never reused implicitly for marketing or billing messages.
