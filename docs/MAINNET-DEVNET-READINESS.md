# JARVIS Swap — Mainnet / Devnet readiness

Version remains `1.0.0-rc.15`.

## Readiness model

JARVIS now separates **application readiness** from **swap readiness**.

- `/api/v1/ready` answers whether the deployed application can safely serve its configured profile.
- `/api/v1/swap/readiness` answers whether real swap execution is enabled.
- `/api/v1/deployment/status` exposes a secret-free capability matrix for Swap, Send, Receive, Portfolio, Pools, wallet sessions, and persistence.

This matters on Devnet: Sui wallet/RPC/Send/Receive development is supported, while Cetus Aggregator swap execution is intentionally disabled. Devnet can therefore be healthy without falsely advertising live swaps.

## Mainnet profile

Mainnet is fail-closed. A production-ready profile requires:

- `NEXT_PUBLIC_SUI_NETWORK=mainnet`
- `JARVIS_READINESS_REQUIRE_SWAP=true`
- dedicated HTTPS Sui gRPC endpoint(s)
- real canonical `JARVIS_SUI_COIN_TYPE`
- real non-zero `JARVIS_SWAP_FEE_WALLET`
- signed quotes and a high-entropy quote secret
- wallet-authenticated sessions and HTTPS `NEXT_PUBLIC_APP_URL`
- published/audited Move fee package + Config object
- on-chain fee enforcement enabled
- successful Sui network/chain identity check
- PostgreSQL health when durable persistence is enabled

Validate the active Mainnet environment with:

```bash
pnpm validate:mainnet-ready
```

## Devnet profile

Devnet is intended for RPC, Wallet Standard, Send/Receive, token metadata, portfolio, session and transaction-pipeline development. Cetus swaps stay fail-closed because Cetus Aggregator does not provide a Devnet routing environment.

Use:

```env
NEXT_PUBLIC_SUI_NETWORK=devnet
NEXT_PUBLIC_SUI_CLUSTER=devnet
JARVIS_READINESS_REQUIRE_SWAP=false
JARVIS_REQUIRE_DEDICATED_RPC=false
```

Validate with:

```bash
pnpm validate:devnet-ready
```

A Devnet deployment returning `ready: true` does **not** imply `swapReady: true`; clients must consume the explicit capability fields.

## Testnet

Testnet remains the preferred persistent public test environment for full swap integration. JARVIS restricts Testnet Cetus routing to Cetus/DeepBook provider families, matching the supported Aggregator test environment. Use `pnpm validate:testnet-ready`.

## Go-live sequence

1. Deploy/test contracts and canonical token configuration on the target network.
2. Validate environment/profile.
3. Run Prisma migrations when persistence is enabled.
4. Run `pnpm check` and `pnpm build:production`.
5. Verify `/api/v1/ready`, `/api/v1/deployment/status`, and `/api/v1/swap/readiness` after deployment.
6. Execute low-value end-to-end transactions before enabling unrestricted production traffic.
