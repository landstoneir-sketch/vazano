# Attachments module

Files are stored in private S3-compatible object storage; only metadata and ownership references are stored in PostgreSQL.

- Uploads use short-lived signed `PUT` URLs.
- MIME type and extension must match the allow-list, and declared size is checked against object metadata.
- Download URLs are short-lived and issued only after backend authorization.
- Production defaults to `PENDING_SCAN` until a malware-scanner adapter is configured. Development may use the explicit `development-bypass` mode.
