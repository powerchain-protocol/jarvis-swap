# JARVIS Swap rc.15 — Resilience and Data Hardening

This pass keeps the application version at `1.0.0-rc.15` and strengthens degraded-network UX and untrusted upstream-data handling.

## User experience

- The application now displays a compact global status banner when the browser is offline or Sui network health checks are degraded.
- Offline state explicitly pauses the user's expectation of quotes and transactions instead of leaving controls appearing silently stale.
- Degraded Sui state offers an explicit retry action and states that finality remains authoritative.
- The banner is responsive and safe-area aware on mobile.

## Upstream market data

Pyth, Birdeye, and CoinGecko JSON payloads are now parsed from `unknown` through runtime shape validation. Invalid, non-positive, or malformed prices are rejected before they reach portfolio or swap presentation state.

## Client API consistency

Wallet and portfolio clients now use the shared structured API-error reader instead of assuming every backend error is a string. Portfolio fetches also accept an `AbortSignal` so navigation/unmount cancellation can propagate correctly.

## Safety invariants

These improvements do not change transaction authority. Quotes, wallet signing, transaction simulation, signature verification, idempotent execution, Sui finality, and the 250 bps service-fee cap remain unchanged.

## Network polling

The network-health hook now aborts superseded checks, pauses periodic polling while the document is hidden, reacts immediately to browser online/offline events, and runtime-validates the network status response before updating shared RPC state.
