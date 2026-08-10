# JARVIS Swap rc.15 — Liquidity and market-data library hardening

The application version remains `1.0.0-rc.15`.

## Stable application facades

Provider-specific implementations now have stable facades under `src/lib/`:

- `pyth.ts` — Pyth/Hermes price feed access
- `birdeye.ts` — Birdeye Sui market data
- `coingecko.ts` — CoinGecko fallback market data
- `cetus.ts` — Cetus Aggregator V3 and configured-pool access
- `deepbook.ts` — explicit DeepBook V3 capability boundary

`coingecho.ts` is retained only as a typo-compatible alias and should not be used by new code.

## Swap domain service

`src/services/swap.ts` is the server-side swap-domain boundary. It performs exact decimal-to-base-unit conversion, service-fee splitting, Cetus exact-input routing, slippage minimum-output calculation, price-impact enforcement, and exact presentation-string generation.

The versioned quote API calls this service instead of duplicating financial logic in the route handler.

## DeepBook

DeepBook configuration is opt-in:

```env
DEEPBOOK_ENABLED=false
DEEPBOOK_POOL_IDS=
```

The integration intentionally fails closed for execution until an audited DeepBook SDK transaction adapter and reviewed pool IDs are installed. The application does not invent order-book quotes or transaction blocks.

## Move fee contract

`contracts/swap/sources/swap.move` now exposes the maximum service-fee policy, centralizes policy verification, rejects zero-value fee collection, and keeps the hard 250 bps maximum on-chain.

## Compatibility paths

The following compatibility entry points are present for modular application code:

- `src/types/pool.ts` → canonical `src/types/pools.ts`
- `src/app/utils/util.ts` → shared formatting/rate/token/helper utilities
- `src/app/utils/errors.ts` → shared `AppError` system
