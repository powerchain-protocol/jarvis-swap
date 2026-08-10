# RC15 Wallet Sessions, Fees, and Market Data Hardening

Version remains `1.0.0-rc.15`.

## Wallet session

JARVIS separates wallet discovery/connection from authenticated application sessions. A secure session is created by:

1. `POST /api/v1/session/challenge` creates a short-lived, HMAC-signed, address/network-bound nonce and places the challenge token in an HTTP-only SameSite=Strict cookie.
2. The wallet signs the exact challenge with Wallet Standard `sui:signPersonalMessage`. This is a personal-message signature, not a Sui transaction signature and cannot spend assets.
3. `POST /api/v1/session/verify` requires the matching browser challenge cookie and verifies the signature for the requested Sui address.
4. The server sets a signed HTTP-only session cookie bound to address, Sui network, issued time, expiry, and a random session ID.
5. When `JARVIS_REQUIRE_WALLET_SESSION=true`, transaction preflight and execution require the session address to match the transaction sender.

Disconnect and account/network changes clear the server session. Transaction signatures remain separate and are still simulated, signature-verified, idempotently submitted, and finalized through Sui.

## Balances

Bootstrap token data never represents a live balance. Connected-wallet balances are fetched from Sui, and the UI shows `Balance: —` until the real wallet response arrives. A real zero is displayed as `No balance`, not as fabricated live portfolio data.

SUI Send also loads the real connected balance and reserves the configured `SUI_GAS_RESERVE_MIST` before enabling a transfer.

## Prices, rates, and conversion

Price discovery continues to use Pyth, Birdeye, CoinMarketCap, and CoinGecko with runtime payload validation, timeout/staleness policy, and short-lived cache deduplication.

`GET /api/v1/rates?base=SUI&quote=USDC` derives a market conversion rate from accepted USD price observations. This endpoint is for market display/conversion only. Cetus route output remains authoritative for swap execution.

## Fee model

The maximum JARVIS Swap service fee remains 250 bps (2.5%). It is carved from the user's gross swap input:

- gross input = user-reviewed input
- service fee = `floor(gross * 250 / 10000)`
- Cetus input = gross - service fee

The service fee is transferred to `JARVIS_SWAP_FEE_WALLET` in the same Sui programmable transaction as the swap. If the swap aborts, the atomic PTB aborts with it.

`JARVIS_SWAP_FEE_WALLET` is intentionally **TBA** in example environment files. Production swaps remain disabled/fail-closed until a valid non-zero Sui fee wallet is configured.

Sui network gas is separate from the 2.5% JARVIS service fee. Network gas is charged in SUI by the Sui network and is never redirected to the JARVIS fee wallet. The UI shows the service fee before signing and the simulated Sui network fee after signed-transaction preflight.

## Mainnet minimums

Mainnet should use:

- a high-entropy `JARVIS_SESSION_SECRET`;
- `JARVIS_REQUIRE_WALLET_SESSION=true`;
- `JARVIS_REQUIRE_SIGNED_QUOTES=true`;
- a real `JARVIS_SWAP_FEE_WALLET`;
- dedicated Sui gRPC infrastructure;
- published/audited fee Move package when `JARVIS_REQUIRE_ONCHAIN_FEE=true`.
