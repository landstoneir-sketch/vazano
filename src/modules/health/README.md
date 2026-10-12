# Health module

This module exposes lightweight liveness and dependency-aware readiness endpoints for local orchestration and production deployment checks.

- Liveness confirms that the API process can answer requests.
- Readiness checks dependencies required to serve traffic.
- Health responses must not disclose credentials, connection strings, or internal exception details.
- Deployment automation should route traffic only after readiness succeeds.

