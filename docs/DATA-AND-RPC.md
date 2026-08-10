# Data, RPC and market-price architecture

## Sui network

`src/services/sui/rpc.ts` is the server-side compatibility transport. It rotates through `SUI_RPC_URLS`, times out slow requests, retries 429/5xx/network failures, and never exposes provider credentials to the browser. New production infrastructure should migrate query workloads to the Sui gRPC client; JSON-RPC remains here as a compatibility boundary for the current API methods.

## Wallet data

`GET /api/v1/wallet/{address}` validates/canonicalizes the Sui address and fetches all balances. The swap client refreshes connected-wallet balances every 15 seconds and maps base-unit balances onto configured coin types.

## Price sources

`GET /api/v1/prices` uses the configured provider order and fails over through:

1. Pyth — verified feed ID required per symbol.
2. Birdeye — Sui coin type plus server-side API key.
3. CoinMarketCap — configured asset ID preferred; server-side API key optional where keyless coverage is available.
4. CoinGecko — configured coin ID; demo/pro key supported server-side.

No API key is stored in `NEXT_PUBLIC_*`. A provider response is rejected when it does not contain a finite USD price.

## Swap protections

Protection is layered rather than represented as a vague "MEV-safe" guarantee: quote TTL, strict minimum output, maximum slippage, maximum price impact, fresh Cetus route immediately before signing, exact max router input, and an optional deployment-specific protected RPC endpoint. Expert mode does not disable minimum-output or quote-expiry checks.

## Durable database boundary (rc.8)

Live Sui/Cetus/RPC responses remain authoritative. PostgreSQL stores application history and indexes only: wallet observations, token metadata, provider price samples, quote claims, swap digests/status, fee accounting, pool snapshots and LP position snapshots. A database outage must not be interpreted as a blockchain transaction failure.

Prisma is used only from Node.js server code. Supabase browser access is limited to explicitly designed auth/session workflows; swap financial tables have RLS enabled and no public policies by default.
