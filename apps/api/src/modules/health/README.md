# Health module

This module exposes lightweight liveness and dependency-aware readiness endpoints for local orchestration and production deployment checks.

- Liveness confirms that the API process can answer requests.
- Readiness checks dependencies required to serve traffic.
- Health responses must not disclose credentials, connection strings, or internal exception details.
- Release responses expose only the immutable source revision baked into the image so deployment automation can reject stale containers.
- Deployment automation should route traffic only after readiness succeeds.

