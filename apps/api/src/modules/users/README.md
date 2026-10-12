# Users module

This module owns the authenticated user's profile and administrative user/session operations.

- A user may edit only their own profile through ordinary endpoints.
- Administrative reads and session revocation require explicit permissions.
- Sensitive authentication data, OTP values, session tokens, and full personal data are never returned or logged.
- User status changes and forced logout actions are recorded in the audit trail.
- Organization membership and role management remain in the organizations module.

