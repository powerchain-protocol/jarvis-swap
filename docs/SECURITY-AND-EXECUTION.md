# JARVIS Swap rc.5 — transaction integrity and execution

## Execution invariants

1. Quotes are produced server-side from canonical coin types and deployment policy.
2. The gross input, net swap input, service fee, recipient, minimum output, slippage, expiry and price-impact ceiling are bound into quote claims.
3. When `JARVIS_QUOTE_SIGNING_SECRET` is configured, claims are HMAC-SHA256 signed by the server. `JARVIS_REQUIRE_SIGNED_QUOTES=true` makes unsigned quotes fail closed.
4. The client verifies the quote with `/api/v1/swap/verify` immediately before building the Sui PTB.
5. A fresh Cetus route must still meet or beat the reviewed minimum output.
6. Service fee collection and the swap execute in the same Sui PTB, so a failed swap rolls back the fee transfer.
7. If the Move fee package is configured, `swap::collect_fee<T>` receives the reviewed fee BPS and recipient and aborts when the shared config changed after quote issuance.
8. `JARVIS_REQUIRE_ONCHAIN_FEE=true` disables the migration fallback and requires the published Move package/config object.
9. A wallet digest is only considered **submitted**. JARVIS Swap waits for Sui confirmation before displaying **confirmed**.

## Price safeguards

Market prices are display/risk inputs, not execution truth. Cetus route output remains the executable swap source. Price-provider responses are rejected when stale, non-positive, or—on Pyth—when the confidence interval exceeds `PYTH_MAX_CONFIDENCE_BPS`.

## Mainnet checklist

- Generate a high-entropy `JARVIS_QUOTE_SIGNING_SECRET` and keep it server-side.
- Enable `JARVIS_REQUIRE_SIGNED_QUOTES=true`.
- Publish and audit `contracts/swap`, then set `JARVIS_SWAP_PACKAGE_ID` and `JARVIS_SWAP_CONFIG_OBJECT_ID`.
- Enable `JARVIS_REQUIRE_ONCHAIN_FEE=true` after the Move object values are verified.
- Verify the 2.5% fee wallet independently on-chain and in deployment configuration.
- Configure production Sui gRPC/RPC providers and provider allowlists.
- Configure authenticated Pyth Hermes access before the August 18, 2026 requirement.
- Run `pnpm check` and Move tests in CI before release.


## rc.7 signed preflight pipeline

The wallet now signs without broadcasting. JARVIS sends the signed transaction bytes to `/api/v1/transactions/preflight`, simulates them through Sui gRPC, then submits the exact same signed bytes to `/api/v1/transactions/execute`. The execution endpoint verifies the wallet signature against the expected sender and re-simulates immediately before submission. A failed simulation never reaches execution.

This does not make simulation a consensus guarantee: shared-object state may still change between simulation and execution. Minimum-output, max-input, quote-expiry, fee-policy, and on-chain Move checks remain the authoritative transaction protections.

## Concurrent idempotency reservation

Transaction execution requires an `Idempotency-Key`. The server reserves that key **before** signature verification, final simulation, and Sui submission. This closes the classic read-then-write race where two concurrent HTTP requests can both observe a missing idempotency record and submit the same signed payload.

With PostgreSQL persistence enabled, the primary-key constraint on `jarvis_swap_api_idempotency.key` is the cross-instance lock. Without persistence, JARVIS uses a bounded process-local reservation as a degraded fallback. A reused key with a different canonical payload hash is rejected with `409 Conflict`; a matching request already in progress returns `409` plus `Retry-After`; a completed matching request replays the stored response.

The request hash is generated from stable key-sorted JSON so semantically equivalent object key ordering does not produce a different hash. Validation/preflight failures release a reservation because no submission was attempted. Once an execution RPC is attempted, an ambiguous upstream failure keeps the reservation until expiry rather than encouraging an unsafe immediate duplicate submission.
