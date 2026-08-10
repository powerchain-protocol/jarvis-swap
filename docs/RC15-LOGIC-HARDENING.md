# RC.15 Logic hardening

This pass keeps the application version at `1.0.0-rc.15` and tightens transaction and API invariants.

## Changes

- Added one typed transaction-envelope parser used by preflight, execution, and confirmation.
- Removed duplicated ad-hoc `any` parsing of Sui success/failure and gas fields from critical transaction routes.
- Added bounded JSON parsing to preflight, swap validation, and signed-quote verification.
- Added rate limiting to quote verification, swap validation, transaction preflight, and transaction status polling.
- Standardized no-store/nosniff API responses for these boundaries.
- Transfer execution now validates and canonicalizes the Sui coin type and token decimals before transaction construction.
- Transaction status polling preserves a 504-style upstream timeout rather than turning confirmation uncertainty into a generic internal error.
- Gas accounting uses one parser and clamps effective gas to zero when storage rebate exceeds charged costs.

## Transaction invariant

A wallet signature or returned digest is not confirmation. The transaction lifecycle remains:

1. construct transaction;
2. wallet signs exact bytes;
3. server simulates exact bytes;
4. server verifies signature/sender;
5. server re-simulates immediately before submit;
6. idempotent submission;
7. wait for Sui finality;
8. persist/reconcile confirmed state.

- Liquidity action validation now uses bounded request parsing and rejects empty add/remove-liquidity intents before any future execution adapter can consume them.

## Additional runtime-shape hardening

- Added `src/services/sui/object-shapes.ts` so Sui Core/gRPC object payloads are narrowed from `unknown` before pool/position code reads them.
- Removed remaining `any` parsing from the configured pool registry, Cetus compatibility parser, and CLMM position parser.
- Custom-token metadata resolution now uses a 2 KiB bounded request body, per-client rate limiting, no-store API errors, and HTTPS-only remote icon URLs.
- Removed the unused client-side Wallet Standard `signAndExecuteTransaction` capability. Application transaction execution continues through the guarded server path: wallet signs exact bytes, server verifies/simulates, idempotent submission occurs, then Sui finality is checked.
