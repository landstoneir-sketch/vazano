# Authentication module

This module owns OTP login, session creation and revocation, authenticated-user resolution, and the SMS provider port.

- Mobile numbers are normalized before lookup and OTP values are stored only as protected digests.
- OTP issuance and verification are rate-limited and resistant to brute-force attempts.
- Production requires SMS.ir and forbids OTP debug mode.
- Session cookies are HTTP-only; authorization decisions remain in backend services and guards.
- Users can inspect their own active sessions and revoke an individual device without seeing token digests; self-revocation also clears the browser cookie.
- Provider-specific SMS template identifiers stay behind `SmsPort` adapters.

