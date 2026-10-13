# Attachments module

Files are stored in private S3-compatible object storage; only metadata and ownership references are stored in PostgreSQL.

- Uploads use short-lived signed `PUT` URLs.
- MIME type and extension must match the allow-list, declared size is checked against object metadata, and the actual file signature is verified before malware scanning.
- Download URLs are short-lived and issued only after backend authorization.
- Production requires the `clamav` adapter. Clean files become `READY`, detected files become `QUARANTINED`, and scanner outages leave files in `PENDING_SCAN` for a safe retry.
- Development may use the explicit `development-bypass` mode. The core module talks to ClamAV through its standard `INSTREAM` protocol and does not depend on a vendor SDK.
- RFQ files and supplier-verification documents use separate ownership scopes and storage prefixes. Supplier owners/managers may upload verification documents; verification operators receive read-only access through the `supplier.verify` permission.
- Internal bucket names, object keys, checksums, and scanner details are never returned in supplier profile responses.
