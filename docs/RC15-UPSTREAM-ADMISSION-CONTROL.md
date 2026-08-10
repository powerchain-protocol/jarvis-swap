# RC15 upstream admission control

JARVIS Swap `1.0.0-rc.15` uses two complementary abuse/resilience controls for expensive public endpoints.

1. The existing request rate limiter limits how frequently one hashed client identity can call an API and can use PostgreSQL for distributed counters.
2. Per-runtime concurrency budgets cap simultaneous upstream work performed by one application instance. A small FIFO queue absorbs short bursts; when the queue is full or the configured wait expires, the request fails with HTTP 503 and `Retry-After` instead of creating unbounded Cetus, Sui RPC, or market-provider fan-out.

The admission-control budgets currently protect swap quote construction, portfolio valuation, and aggregate price retrieval. The controls wrap only expensive upstream work, after cheap input/rate-limit checks where practical.

## Environment

```env
API_QUOTE_CONCURRENCY=12
API_PORTFOLIO_CONCURRENCY=8
API_PRICE_CONCURRENCY=16
API_REQUEST_QUEUE_LIMIT=32
API_REQUEST_QUEUE_WAIT_MS=2000
```

These values are per application runtime/instance. They are not a substitute for distributed rate limiting or provider-side quotas. Mainnet operators should tune them to RPC/Cetus/price-provider limits and the deployment's instance size; Devnet and Testnet can use the defaults unless provider quotas require lower values.

`GET /api/v1/deployment/status` exposes the configured limits, but never provider credentials or endpoint secrets, so operations can verify the running profile.

## Failure policy

Capacity exhaustion fails closed with a temporary `503 Service Unavailable`. The response includes `Retry-After` where routed through the common API error handling. Financial quote APIs remain `no-store`; no stale quote is substituted when capacity is exhausted.

The 2.5% maximum JARVIS service-fee policy and atomic Sui PTB settlement rules are unchanged by this pass.
