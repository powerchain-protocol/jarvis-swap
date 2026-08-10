# RC15 Client Resilience Hardening

Version remains `1.0.0-rc.15`.

This pass improves client/runtime safety without changing transaction economics or deployment semantics.

## HTTP retries

The shared `fetchJson()` helper now:

- preserves a caller-provided `AbortSignal` while adding its own timeout;
- does not accidentally retry non-retryable 4xx responses;
- retries only safe HTTP methods by default;
- respects `Retry-After` on 429/5xx responses when present;
- bounds exponential retry delays.

Unsafe methods can only be retried when a caller opts in explicitly.

## Realtime frames

WebSocket input is untrusted. Realtime messages are now runtime-validated, limited to 256 KiB, restricted to known topics/networks, and monotonic sequence numbers are enforced per topic. Duplicate or out-of-order sequenced events are dropped.

Realtime remains a freshness hint. Sui finality remains authoritative.

## Local persistence

Settings, preferences, and custom token data are now loaded through bounded JSON storage helpers. Corrupt or oversized localStorage values fall back to safe defaults. Custom token persistence is capped to 100 entries.

## Exact input validation

The Swap UI uses decimal-string positivity and balance comparison as its primary input gate. JavaScript `Number` is retained only for approximate USD presentation; execution amounts continue through exact decimal text and integer base units.

## Structured client errors

Transaction confirmation and custom-token import now preserve the server's structured API error messages rather than assuming `error` is always a plain string.

## Sui Core response normalization

Additional gRPC/Core read paths now narrow SDK responses from `unknown` before consuming balances, service info, gas price, transaction pages, owned-object pages, or object batches. This removes compile-time `TS18046` failures and makes minor upstream response-shape changes fail safely instead of being dereferenced blindly.
