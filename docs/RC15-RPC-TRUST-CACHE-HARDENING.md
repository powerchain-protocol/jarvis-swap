# RC15 RPC, trust registry, and cache hardening

Version remains `1.0.0-rc.15`.

## Sui RPC routing

Read traffic now ranks configured gRPC endpoints using observed reliability and an exponentially weighted moving-average latency. Repeated failures still quarantine an endpoint with bounded backoff, while recovered endpoints can re-enter the pool after a successful probe. The configured endpoint order remains the stable tie breaker before runtime health data exists.

Every gRPC provider is checked against the configured Sui network. Network names such as `sui:mainnet` are normalized before comparison, and providers that expose a chain ID must agree with the chain ID already observed for the active network. A fallback endpoint therefore cannot silently serve a different chain/fork under the same deployment.

`GET /api/v1/network/status` exposes only sanitized host-level diagnostics and identifies the currently preferred read endpoint. Secrets, paths, credentials, and query parameters are never returned.

## Trusted-token canonicalization

Trusted-token verification now canonicalizes every Sui coin type before storing or comparing it. This fixes short-address variants such as `0x2::sui::SUI` versus the canonical 32-byte address form. Trust remains based on exact active-network + canonical coin-type matching, never symbol/name/icon metadata.

`GET /api/v1/tokens/trusted` now returns a deterministic SHA-256 registry identifier. The identifier changes when the network or trusted token definitions change, which lets clients and operators detect stale registry configuration without exposing secrets.

## Runtime configuration actually enforced

`PORTFOLIO_CACHE_TTL_MS` now controls the live portfolio cache TTL instead of being documentation-only.

`API_RATE_LIMIT_WINDOW_MS` is now the default window used by versioned API rate limits instead of every route silently hard-coding 60 seconds. Per-route request limits remain distinct.

These changes are production hardening only and do not alter the `1.0.0-rc.15` version or the 250 bps / 2.5% maximum service-fee policy.
