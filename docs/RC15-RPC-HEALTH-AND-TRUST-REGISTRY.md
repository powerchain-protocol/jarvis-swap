# rc.15 RPC health and trusted-token registry hardening

The application version remains `1.0.0-rc.15`.

## RPC endpoint health

Sui gRPC read failover now keeps bounded in-process health state per configured endpoint. Consecutive failures quarantine an endpoint for a configurable cooldown instead of retrying a known-bad provider on every wallet, pool, portfolio, and metadata request. Successful requests immediately clear the failure streak.

Configuration:

```env
SUI_RPC_FAILURE_THRESHOLD=3
SUI_RPC_COOLDOWN_MS=15000
```

The cooldown grows with repeated failures, capped to a bounded multiplier. If every endpoint is quarantined, JARVIS probes the pool rather than remaining permanently unavailable. Network status exposes only sanitized host-level health data; API keys and URL query strings are never returned.

The transaction path remains stricter than read failover. Simulation uses the configured primary gRPC endpoint and submission uses the protected endpoint when configured. Both must pass the Sui network-identity check.

## RPC configuration validation

`SUI_PROTECTED_RPC_URL` now receives the same URL safety checks as read endpoints: no embedded credentials, HTTP(S) only, and HTTPS required on Mainnet. Duplicate gRPC URLs are removed from the runtime pool. Custom RPC labels are bounded and reject control characters.

## Trusted token conflicts

The trusted registry now rejects conflicting aliases for reserved symbols: `SUI`, `USDC`, `JARVIS`, and `CCT`. Operator-provided `TRUSTED_TOKEN_COIN_TYPES` may add reviewed assets but cannot remap one of these names to an unrelated coin type.

Verification remains based on exact coin type plus active Sui network. RPC metadata, token name, symbol, and icon are descriptive only and never establish trust.
