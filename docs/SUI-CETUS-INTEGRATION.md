# Sui, Cetus, fees, CCT and zk account integration

## Atomic swap model

JARVIS Swap uses Cetus Aggregator V3 for route discovery and transaction construction. For a gross input `G` and service-fee basis points `B`, the application computes `fee = floor(G × B / 10,000)` and swaps `G - fee`.

The fee transfer and Cetus swap are placed in the **same Sui programmable transaction block (PTB)**. Sui PTBs are atomic: if the swap fails, the fee transfer also rolls back. The default is `250 bps = 2.50%`.

The service fee is distinct from Sui gas and from liquidity-provider / DEX fees already reflected by the Cetus route. The UI must show these separately.

## Fee-wallet validation

`JARVIS_SWAP_FEE_WALLET` must be a non-zero canonical Sui address whenever `JARVIS_SWAP_SERVICE_FEE_BPS > 0`. Startup/API configuration fails closed if it is missing or invalid. Never use a private key as the fee-wallet variable.

## Tokens

SUI and mainnet USDC have canonical types in configuration. `JARVIS_SUI_COIN_TYPE` and `CCT_SUI_COIN_TYPE` are deployment-specific and must be supplied before those assets can execute live swaps. JARVIS remains canonical on Sui.

## Cetus pools

Set `CETUS_POOL_IDS` to a comma-separated allowlist of CLMM pool object IDs. `/api/pools` validates and resolves those objects through Sui RPC. The project depends on the current Cetus SDK v2 package for future position/add/remove-liquidity transaction builders; do not use the deprecated v1 CLMM SDK.

## zk / zkLogin

JARVIS Swap does not implement a custom zkSNARK prover. Sui zkLogin/Enoki-compatible accounts are accepted through Wallet Standard when their wallet exposes the normal Sui signing feature. Proof generation, OAuth identity handling, salts and ephemeral-key management belong in a dedicated zkLogin/Enoki adapter rather than the swap transaction builder.

## Safety checks

Before signing, the client refreshes the Cetus route, verifies that output remains above the user-reviewed minimum, caps router input at the post-fee net amount, and requires an unexpired quote. The wallet performs the final signature and submission. No private key is stored by JARVIS Swap.
