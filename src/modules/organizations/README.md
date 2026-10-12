# Organizations module

This module owns buyer and supplier organizations, memberships, invitations, and organization-scoped role changes.

- Every organization resource is tenant-scoped in backend queries.
- Only authorized owners or managers can invite members or change roles.
- Role changes are validated by the member policy to prevent privilege escalation and loss of the last required owner.
- Membership actions are written to the audit trail.
- Commercial profiles remain in buyer/supplier modules; this module owns identity and membership boundaries only.

