# RC15 wallet-data and cache resilience

This hardening pass keeps the application version at `1.0.0-rc.15`.

## Shared wallet data lifecycle

`useWalletData()` centralizes connected-wallet balance hydration for UI surfaces. It:

- never presents an initial bootstrap `0` as a confirmed on-chain balance;
- cancels superseded component waits;
- ignores stale responses using a monotonic request id;
- refreshes after confirmed JARVIS transactions;
- refreshes on realtime wallet invalidation hints;
- refreshes after the browser returns online or becomes visible;
- polls only while the page is visible and online;
- keeps a bounded 15-second foreground refresh cadence.

The wallet account menu now reports `Loading SUI balance…`, `Balance unavailable`, `No SUI balance`, or the exact hydrated SUI balance instead of treating all missing data as zero.

Send uses the same wallet lifecycle and forces an immediate balance refresh after Sui finality.

## Cancellation-safe request deduplication

The short-lived wallet and price caches deduplicate concurrent requests. A caller-owned `AbortSignal` is no longer attached to the shared underlying fetch, because one unmounting component could otherwise abort the request for every component awaiting the same cache key.

The shared request runs independently; `withAbortSignal()` lets each caller cancel only its own wait. This preserves both request deduplication and correct React lifecycle cancellation.

Security-sensitive quote, signature, preflight, execution, and finality paths are not moved into this cache model.
