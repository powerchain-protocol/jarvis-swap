# JARVIS Swap database layer

Runtime adapters live here. The canonical schema and migration sources are intentionally separated at the repository root:

- `/prisma` — Prisma schema and Prisma migration history
- `/supabase` — Supabase CLI config and SQL migrations
- `/migration` — reviewed provider-neutral SQL + workflow notes
- `/schemas` — TypeScript validation/domain contracts
- `/database/prisma` — server-only Prisma client and repositories
- `/database/supabase` — browser, SSR and privileged Supabase clients

PostgreSQL persists off-chain application state only. Sui remains authoritative for balances, transaction finality, object ownership, Cetus pool state and liquidity positions.
