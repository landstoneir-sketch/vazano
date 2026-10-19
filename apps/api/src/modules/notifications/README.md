# Notifications module

This module converts supported transactional outbox events into tenant-scoped notifications.

- Templates are versioned database records and keep rendered snapshots on each notification.
- A channel-specific dispatch receipt prevents duplicate processing without consuming the shared outbox event.
- The current MVP business-event channel is `IN_APP`; OTP is delivered through the independent SMS provider adapter. Business SMS, email, and push use the same event/template boundary after their provider-specific templates are approved.
- Organization-member invitations create an in-app notification linked directly to the organization page. A separate SMS.ir pattern ID is required before enabling its SMS channel; the OTP pattern is never reused for business messaging.
- Every read operation is scoped to the authenticated recipient.
