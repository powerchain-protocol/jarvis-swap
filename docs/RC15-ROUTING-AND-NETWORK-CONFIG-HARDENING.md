# RC15 Routing and Network Configuration Hardening

Version remains `1.0.0-rc.15`.

This pass closes configuration and liquidity-routing gaps without changing the public release version.

## Changes

- Swap status/configuration can be inspected while `JARVIS_SWAP_FEE_WALLET` is intentionally TBA. Quote and execution paths still fail closed when a non-zero service fee requires a wallet.
- Cetus providers are validated against the SDK-known provider set and the deployment `CETUS_ALLOWED_PROVIDERS` policy. A caller cannot bypass a configured allowlist by supplying another provider name.
- `CETUS_POOL_IDS` and `DEEPBOOK_POOL_IDS` are normalized and validated as Sui object IDs at configuration load time.
- Mainnet USDC is only defaulted on Mainnet. Testnet and Devnet must explicitly configure `SUI_USDC_COIN_TYPE`; the Mainnet coin type is never silently reused on another network.
- Added `GET /api/v1/swap/readiness`, which reports swap blockers, non-blocking warnings, network, and liquidity-source policy without exposing secrets.

## Fee wallet behavior

A TBA fee wallet is a deployment blocker when `JARVIS_SWAP_SERVICE_FEE_BPS > 0`, not a reason for read-only configuration/status endpoints to crash. Production quote/execution remains disabled until the address is configured and validated.
