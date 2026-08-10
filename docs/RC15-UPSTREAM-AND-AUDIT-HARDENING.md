# RC15 upstream and audit hardening

This pass keeps the application version at `1.0.0-rc.15` and focuses on runtime correctness.

## Changes

- Cetus quote requests now have an explicit server-side timeout and circuit breaker to reduce cascading failures when the upstream router is degraded.
- Cetus route parsing no longer relies on unrestricted `any` access for quote IDs, deviation ratios, or provider paths.
- CoinMarketCap response parsing now treats remote JSON as `unknown` and validates the nested quote shape before consuming it.
- Quote input validation no longer uses JavaScript floating-point numbers as the primary validity gate. Decimal text is validated first and exact base units remain authoritative.
- Transaction persistence metadata is validated before it can enter the database. Fee BPS must match deployment policy and the submitted service-fee base units must equal the exact integer fee derived from the gross input.
- Added `CETUS_QUOTE_TIMEOUT_MS` to every environment profile.

## Security invariant

Database audit records are not allowed to accept a client-supplied fee amount that conflicts with the deployment fee policy. On-chain Sui effects remain the ultimate source of truth and reconciliation remains required after finality.
