# Environment profiles

Copy one profile to the repository root as `.env.local` and fill the real deployment values. Never commit production RPC keys or signing secrets.

`JARVIS_SWAP_FEE_WALLET` is a public on-chain recipient address, but it is server-configured so the application has one canonical fee destination. With the default `250` basis points, every JARVIS Swap transaction sends 2.50% of the gross input asset to that address in the same atomic Sui PTB that performs the swap.

The app fails closed when a non-zero service fee is configured without a valid non-zero fee wallet.

## Network profiles

- `.env.devnet.example` — unstable Sui Devnet for protocol experiments; state may be wiped regularly.
- `.env.testnet.example` — recommended public testing profile.
- `.env.mainnet.example` — production profile. Use a dedicated Sui gRPC provider; Foundation public-good fullnodes are not production capacity.

JARVIS application reads and transaction preflight use Sui gRPC/Core APIs. JSON-RPC is retained only as an explicit compatibility helper for third-party providers and is not used by readiness, wallet balances, token metadata, or pool discovery.
