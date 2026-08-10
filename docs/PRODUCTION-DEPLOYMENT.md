# JARVIS Swap production deployment — rc.15

## Mainnet gates

1. Use `.env.mainnet.example`, set `JARVIS_READINESS_REQUIRE_SWAP=true`, and configure dedicated Sui gRPC endpoint(s).
2. Set `JARVIS_REQUIRE_DEDICATED_RPC=true`.
3. Set a high-entropy `JARVIS_QUOTE_SIGNING_SECRET` and keep `JARVIS_REQUIRE_SIGNED_QUOTES=true`.
4. Publish/audit the fee Move package, configure `JARVIS_SWAP_PACKAGE_ID` and `JARVIS_SWAP_CONFIG_OBJECT_ID`, and keep `JARVIS_REQUIRE_ONCHAIN_FEE=true`.
5. Set and independently verify `JARVIS_SWAP_FEE_WALLET`, canonical JARVIS coin type, CCT coin type if enabled, and audited Cetus pool IDs.
6. Configure durable PostgreSQL/Supabase persistence and `CRON_SECRET` for reconciliation.
7. Run `pnpm validate:mainnet-ready`, `pnpm check`, Move tests, dependency/security scanning, and an external audit before enabling real-value mainnet trading.

## Transaction invariants

- Wallet connection and signing use Sui Wallet Standard.
- Every signed transaction is simulated server-side before execution.
- The execution endpoint verifies the transaction signature against the expected sender.
- Execution is idempotency-key protected and rate limited.
- Swap service fee and swap are composed atomically in one Sui transaction.
- Send transfers use the same sign → simulate → execute pipeline.
- A transaction digest is treated as submitted, not confirmed, until Sui finality is observed.

## Devnet / Testnet

Devnet is supported for network/RPC/wallet/send/receive/token/portfolio testing, but Sui Devnet is volatile. `JARVIS_READINESS_REQUIRE_SWAP=false` allows the application to be healthy while Cetus swap capability remains explicitly disabled. Testnet is the preferred persistent public test environment. Cetus routing remains fail-closed when no valid route exists.

## Send / receive

The wallet menu exposes Send and Receive. Send builds a standard Sui programmable transaction from the connected sender, creates the requested coin balance through the SDK transaction coin intent, transfers it to a normalized non-zero Sui recipient, requests a Wallet Standard signature, simulates the exact signed bytes, and submits through the same idempotent server execution boundary as swaps. Receive never generates custody keys; it only displays/copies the connected wallet address and links to the matching Suiscan network.
