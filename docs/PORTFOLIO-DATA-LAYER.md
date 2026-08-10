# Portfolio & Data Layer — rc.11

The portfolio API reads live Sui balances, resolves coin metadata, values assets only when an accepted price provider returns a fresh price, and excludes unpriced assets from the USD total rather than fabricating a price. Portfolio and token metadata requests are cached for short TTLs and can be explicitly refreshed after confirmed Sui transactions.

## Safety boundaries
- Sui remains the source of truth for balances and finality.
- Market providers are valuation-only; they never determine swap settlement.
- Unknown tokens remain unverified.
- Durable rate limits and idempotency use PostgreSQL when persistence is enabled and fall back to process memory for local development.
- `Idempotency-Key` is required by clients for safe retry semantics on transaction execution. Reuse with a different payload returns a conflict.

## UX
- `/portfolio` loads live balances and persisted history.
- `/tokens` searches discovered wallet assets and uses a windowed list to keep large token sets responsive.
- user display/filter preferences are persisted locally.
- confirmation emits `jarvis-swap:transaction-confirmed`, causing an optimistic portfolio refresh.
