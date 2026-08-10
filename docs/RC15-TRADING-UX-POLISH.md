# RC15 Trading UX polish

Version remains `1.0.0-rc.15`.

This pass improves day-to-day trading ergonomics without weakening transaction safeguards.

## Exact quick amounts

The pay token surface now exposes 25%, 50%, 75%, and MAX actions after a wallet is connected. Percentage values are derived from the exact decimal balance text with bigint-backed ratio math and are floored to the token's configured decimal precision. SUI presets use the already gas-reserved spendable balance rather than the raw wallet balance.

## Quote freshness

Users can manually request a fresh route from the quote summary. This increments the existing monotonic quote request generation so stale Cetus responses cannot replace a newer response. The refresh affordance is compact on mobile and respects reduced-motion preferences.

## Workspace continuity

The selected pay/receive pair and order tab are persisted in bounded local storage. Restored values are checked against the known token registry and same-token pairs are rejected. No amount, quote, signature, or transaction state is persisted.

## Preserved invariants

- JARVIS service fee remains capped at 250 bps / 2.5%.
- Amount execution remains base-unit/integer safe.
- SUI MAX continues to reserve configured gas.
- Quotes remain signed and short-lived.
- Transaction submission remains simulation + signature verification + idempotency + Sui finality.
