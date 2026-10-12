# RFQ module

This module owns RFQ drafts, item specifications, attachments, review, publishing, supplier distribution, commitment payments, and lifecycle rules.

- RFQs belong to one buyer organization and every read/write is tenant-scoped.
- Product fields and units are driven by catalog data rather than stone-specific code.
- Publishing requires a valid review state and server-side completeness checks.
- Distribution records explain which suppliers received an RFQ and support audited manual operator assistance.
- Attachments are referenced from object storage and must pass file-safety controls.
- Payment and callback handling use idempotent provider verification.

