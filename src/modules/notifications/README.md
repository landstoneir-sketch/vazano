# Notifications module

This module converts supported transactional outbox events into tenant-scoped notifications.

- Templates are versioned database records and keep rendered snapshots on each notification.
- A channel-specific dispatch receipt prevents duplicate processing without consuming the shared outbox event.
- The current MVP channel is `IN_APP`; SMS, email, and push can use the same event and template boundary later.
- Every read operation is scoped to the authenticated recipient.
