# RC.15 Network and Precision Hardening

The application version remains `1.0.0-rc.15`.

This hardening pass closes three production-risk classes without changing the public monetary model.

## 1. Sui network identity gate

Transaction simulation and execution now verify the configured Sui gRPC endpoint's reported network before using it. A provider that explicitly reports `mainnet`, `testnet`, or `devnet` and does not match `NEXT_PUBLIC_SUI_NETWORK` causes execution to fail closed.

Network identity checks are cached briefly per `network:endpoint` pair to avoid adding a service-info request to every transaction while still detecting configuration changes quickly.

All ordinary gRPC reads use bounded timeouts derived from `SUI_RPC_TIMEOUT_MS`. Transaction finality continues to use the separate `SUI_TRANSACTION_WAIT_TIMEOUT_MS` deadline.

## 2. Cetus environment safety

Cetus routing is enabled for Mainnet/Testnet only. Devnet is not silently mapped to Cetus Testnet. The quote server, transaction builder, runtime config, and Swap UI all fail closed on Devnet while preserving Send/Receive and other Sui network testing.

Exact-input Cetus quotes are rejected if the router returns an unexpected input amount. Quote fallback IDs are deterministic SHA-256 commitments over the pair, input/output base units, and normalized route paths instead of random identifiers.

Cetus timeout timers are cleared after completion so completed requests do not retain unnecessary timers.

## 3. Exact token amount presentation

Blockchain accounting remains `bigint` base units. Quote responses now additionally carry exact decimal strings:

- `amountOutText`
- `minimumReceivedText`
- `serviceFeeAmountText`

These strings are derived directly from base units and token decimals and are used for token amount display and local transaction activity. Number-valued mirrors remain only for non-authoritative presentation calculations such as USD estimates and displayed exchange rates.

## Invariants

- Service fee remains capped at 250 bps / 2.5%.
- Sui remains the authoritative transaction/finality source.
- JARVIS Swap never maps Devnet to a Cetus Testnet transaction environment.
- Transaction execution fails if the configured and reported named Sui networks conflict.
- Exact blockchain amounts are persisted/signed in integer base units and displayed through deterministic decimal strings.
