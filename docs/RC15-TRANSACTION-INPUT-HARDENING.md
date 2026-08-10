# JARVIS Swap rc.15 — transaction input hardening

This pass keeps the application version at `1.0.0-rc.15` and tightens the transaction boundary.

## Changes

- Transaction bytes are decoded through strict bounded base64/base64url validation rather than Node's permissive decoder alone.
- Wallet signatures are syntax-checked as encoded Sui signatures before cryptographic verification.
- JSON action endpoints reject explicitly non-JSON content types and continue to enforce byte limits.
- Client-supplied `x-request-id` values are accepted only when they are short URL-safe identifiers; otherwise JARVIS generates a fresh UUID.
- Send transactions now use `0x2::balance::send_funds` with `tx.balance()` so fungible transfers can draw from address balances/coin objects and deposit directly into the recipient address balance.
- Stale TypeScript incremental build metadata is excluded from release archives.

These checks do not replace signature verification, simulation, idempotency, or Sui finality. They narrow malformed-input behavior before those more expensive steps are reached.
