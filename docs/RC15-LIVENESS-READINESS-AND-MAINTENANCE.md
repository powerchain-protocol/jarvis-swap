# RC15 liveness, readiness, and maintenance hardening

Version remains `1.0.0-rc.15`.

## Liveness versus readiness

`GET /api/health` and `GET /api/v1/health` are liveness probes only. They do not call Sui, Cetus, price providers, or PostgreSQL, so an upstream outage does not cause the process to be restarted unnecessarily.

`GET /api/v1/ready` is the dependency-aware readiness probe. It checks deployment policy, Sui network reachability, and PostgreSQL when durable persistence is enabled. All dependency checks are bounded by `JARVIS_READINESS_TIMEOUT_MS` (default 5000 ms) and failures return a sanitized 503 response with `Retry-After`.

## Maintenance mode

`JARVIS_MAINTENANCE_MODE=true` makes the deployment not ready while keeping liveness probes healthy. This allows an orchestrator/load balancer to drain traffic without treating the process as crashed. The deployment status endpoint reports the maintenance state without exposing credentials.

The swap-specific `JARVIS_SWAP_OPERATIONS_ENABLED` kill switch remains separate: use it to disable only swaps while keeping the application ready for wallet, portfolio, Send, Receive, and diagnostics.

## Release metadata

Runtime version/service markers now come from `src/constants/release.ts`. This removes stale health-response versions and prevents different API surfaces from advertising different releases.

## Dependency diagnostics

Readiness checks now run Sui and PostgreSQL independently with the same bounded timeout and return only sanitized check metadata (`name`, `required`, `ok`, `latencyMs`). This makes operator diagnostics useful without leaking endpoint URLs, database connection strings, RPC errors, or credentials.

A required dependency failure returns HTTP 503 with `Retry-After: 5`. Optional PostgreSQL remains non-blocking when durable persistence is disabled. When `DATABASE_PERSISTENCE_ENABLED=true`, missing `DATABASE_URL` or a failed `SELECT 1` makes readiness fail closed.
