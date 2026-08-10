# RC15 readiness, RPC, and fee-accounting hardening

This pass keeps the application version at `1.0.0-rc.15` and strengthens three production boundaries.

## Dedicated Mainnet RPC policy

When `JARVIS_REQUIRE_DEDICATED_RPC=true`, production readiness now checks the entire configured gRPC read pool, not only the first endpoint. Public-good Sui fullnode endpoints must not remain as hidden failover targets in that mode. A configured protected submission endpoint is checked by the same policy.

The policy does not block public-good endpoints on Testnet or Devnet, where they remain useful for development.

## Readiness includes required persistence

`GET /api/v1/ready` now checks PostgreSQL when `DATABASE_PERSISTENCE_ENABLED=true`. If durable persistence is explicitly required but the database is unavailable, the deployment is not reported as ready. When persistence is disabled, a database outage does not block the swap service.

The readiness response also reports sanitized cluster/RPC status and warnings without exposing secrets.

## Canonical SUI fee accounting

Total wallet-debit calculation now canonicalizes the pay coin type before deciding whether gross input is itself SUI. Equivalent padded and short forms of `0x2::sui::SUI` therefore produce the same result.

The fee breakdown now explicitly exposes gross input, service fee, net routed input, whether simulated Sui gas is known, and total SUI wallet debit when simulation is available.

The service fee remains capped at 250 bps / 2.5%. Sui network gas remains a separate network charge and is never sent to the JARVIS service-fee wallet.
