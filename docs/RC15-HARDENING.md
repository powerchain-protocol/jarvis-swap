# JARVIS Swap 1.0.0-rc.15 — hardening pass

This hardening pass intentionally keeps the package version at `1.0.0-rc.15`.

## Changes

- Atomic transaction idempotency reservation before Sui submission.
- Idempotency key required on `/api/v1/transactions/execute`.
- Stable canonical JSON hashing for idempotent payload comparison.
- Safe replay of completed execution responses.
- `409 + Retry-After` while an identical request is already processing.
- Idempotency reservation release only before submission is attempted.
- Central `AppError` use for rate-limit failures so `429` is not accidentally converted to a `500` response.
- Standard `RateLimit-*` headers on successful/replayed transaction execution.
- Bounded request-body parsing for the signed transaction execution endpoint.
- Environment validation for idempotency TTL, reservation TTL, and API rate-limit window.
- Send UI now emits the transaction-confirmed refresh event only after the send helper has actually awaited Sui finality.

## Mainnet recommendation

Keep database persistence enabled for production execution endpoints so idempotency reservations and rate limits work across serverless instances. Process-memory fallbacks are intentionally degraded safety nets, not a replacement for shared persistence.


## Additional production hardening (same rc.15 version)

- Reuses one Sui gRPC client per server process/network endpoint to reduce transport churn.
- Removes `unsafe-eval` from the production Content Security Policy; it remains development-only for tooling compatibility.
- Enables HSTS preload semantics in production and upgrades insecure subresource requests.
- Keeps Next.js Cache Components disabled globally because wallet balances, swap quotes, pool state, and transaction state require explicit freshness policies.
- Adds database CHECK constraints for the canonical 250-bps service-fee ceiling, non-negative blockchain amounts, quote bounds, and operational table invariants.
- Returns standard rate-limit metadata on 429 execution responses in addition to `Retry-After`.

These protections are defense-in-depth. Sui transaction simulation, signature verification, quote validation, Move/on-chain fee policy, and Sui finality remain authoritative for execution.
