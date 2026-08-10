# Sui Reconciliation & Data Integrity — rc.12

Sui is authoritative. PostgreSQL/Supabase store indexed observations and UX caches only.

## Activity pagination

`GET /api/v1/wallet/{address}/activity` accepts `before` for older transactions and `after` for newer transactions. These map to the Sui Core API ledger cursors. Never send both.

## Normalization

`src/services/transactions/normalize.ts` converts Sui Core transaction results into a defensive application shape containing status, checkpoint, sender, gas, balance changes, and deterministic event IDs (`digest:eventIndex`). Unknown provider fields are ignored rather than trusted.

## Reconciliation

`GET /api/v1/jobs/reconcile` re-checks persisted submitted/signed swaps against Sui and updates them to confirmed or failed. Normalized chain observations are persisted independently in `jarvis_swap_chain_transactions`.

The endpoint requires `Authorization: Bearer $CRON_SECRET`. Vercel Cron calls it hourly.

## Operational cleanup

`GET /api/v1/jobs/cleanup` removes expired API rate-limit and idempotency records. It is protected by the same cron secret and runs daily.

## Realtime invalidation

Realtime gateway topics (`transactions`, `wallet`, `prices`, `pools`) are converted into browser events. Portfolio and activity views refresh on relevant events. The websocket is a freshness hint, never finality proof.
