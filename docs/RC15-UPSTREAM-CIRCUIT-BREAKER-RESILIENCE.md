# RC15 upstream circuit-breaker resilience

JARVIS Swap keeps release version `1.0.0-rc.15`. This hardening pass adds provider-level circuit breakers to the expensive external dependencies used by quotes and market-data valuation.

## Goals

- Prevent a failing upstream from consuming the full request budget on every request.
- Preserve provider fallback: one unavailable market-data provider must not make all prices unavailable.
- Avoid poisoning a circuit with deterministic client/configuration failures.
- Expose only secret-free circuit state to deployment diagnostics.
- Keep Mainnet fail-closed while allowing healthy Devnet non-swap capabilities to operate.

## Price provider isolation

Each provider has an independent breaker: `price-pyth`, `price-birdeye`, `price-coinmarketcap`, and `price-coingecko`. When one opens, `fetchBestPrice` continues through the configured provider order and can use the next acceptable source.

The Cetus Aggregator uses its own `cetus-aggregator` circuit. An open Cetus circuit affects swap routing only; it does not disable wallet, Send/Receive, RPC, portfolio metadata, or other unrelated capabilities.

## Failure classification

Only availability-class failures contribute to opening a circuit. Timeouts, network failures, HTTP 408/425/429, 5xx responses, and malformed provider responses are retryable. Known bad-request/configuration failures do not count toward the failure threshold.

This distinction matters because a user requesting an unsupported asset must not make the provider unavailable for other users.

## Recovery

After `UPSTREAM_FAILURE_THRESHOLD` consecutive retryable failures, the circuit opens for `UPSTREAM_COOLDOWN_MS`. After cooldown, exactly one request is allowed to probe recovery while concurrent probes fail fast. A successful probe closes and resets the circuit.

Defaults:

```env
UPSTREAM_FAILURE_THRESHOLD=4
UPSTREAM_COOLDOWN_MS=15000
```

## Public diagnostics

`GET /api/v1/deployment/status` returns only breaker names, state, failure count, retry delay, and last success/failure timestamps. It never includes API keys, provider URLs, RPC credentials, wallet addresses, or signing secrets.

## Interaction with admission control

Circuit breakers complement, rather than replace, the existing bounded concurrency queues. The order is effectively:

```text
client rate limit
  -> concurrency/queue admission
  -> provider circuit breaker
  -> external provider
```

This limits both malicious request volume and failure amplification during genuine provider incidents.
