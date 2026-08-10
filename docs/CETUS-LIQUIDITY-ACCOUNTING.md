# Cetus liquidity accounting — rc.13

JARVIS Swap rc.13 upgrades the liquidity surface from object-count discovery to a normalized, auditable accounting layer.

## Source of truth

Sui is authoritative for pool objects and wallet-owned CLMM position objects. PostgreSQL/Supabase stores snapshots only for history, analytics, and reconciliation. A database row never proves that a position currently exists or is in range.

## Transport

Pool and position object reads use the Sui Core API through `SuiGrpcClient`. New mainnet functionality does not depend on the deprecated JSON-RPC object APIs.

## Position normalization

The parser tolerates the flattened JSON representation returned by gRPC and common nested field representations. It extracts, when present:

- pool object ID
- lower and upper tick
- current pool tick
- raw liquidity
- raw fee-owed fields
- reward-owed fields
- previous transaction digest

The range state is derived as `in-range`, `below-range`, `above-range`, or `unknown`. Unknown is preferred over guessing when pool or position fields are unavailable.

## Persistence

The rc.13 migration adds:

- `jarvis_swap_liquidity_pool_snapshots`
- `jarvis_swap_liquidity_position_snapshots`

Amounts are stored as integer-compatible `NUMERIC(78,0)` values. USD columns are optional and are left null until trustworthy token amount and market-price inputs exist.

## Execution boundary

`POST /api/v1/pools/actions/validate` validates liquidity action intents and the configured pool allowlist, but returns `executable: false`.

Open/add/remove/collect/close execution remains fail-closed until the production Cetus SDK transaction adapter is wired, simulated, wallet-signed, idempotently submitted, and reconciled through the same Sui finality pipeline as swaps.

## Operations

`GET /api/v1/jobs/pools` is protected by `CRON_SECRET` and can persist configured pool snapshots when database persistence is enabled. `vercel.json` schedules it hourly.
