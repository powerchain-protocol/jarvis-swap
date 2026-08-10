# RC.15 — Quote settings and exact-balance hardening

This hardening pass keeps the application version at `1.0.0-rc.15`.

## Fixed: user price-impact setting could make execution impossible

Previously the quote server signed the deployment-wide maximum price impact, while transaction execution compared that signed value with the user's selected maximum. A user choosing a stricter value than the deployment maximum could therefore receive a valid quote that could never pass execution validation.

Quotes now carry and sign the effective user protection:

- the client sends `maxPriceImpactBps`;
- the server validates it and clamps it to the deployment ceiling;
- route price impact is checked against that effective limit;
- the effective limit is included in the signed quote;
- execution requires the reviewed setting to match the signed claim.

`routing` and `deadlineMinutes` are also signed so changing either setting invalidates the reviewed quote and forces a refresh.

## Fixed: disconnected users could not obtain a quote

Bootstrap token balances intentionally start at zero. The previous balance guard treated that zero as authoritative even before a wallet was connected, preventing quote discovery for disconnected users.

Balance enforcement now activates only for a connected wallet. Users may inspect live quotes first, but execution still requires a connected wallet and a fresh balance-backed transaction build.

## Exact wallet balances

Wallet hydration now stores:

- `balanceBaseUnits` — exact Sui base units;
- `balanceText` — exact decimal text;
- `balance` — presentation-only numeric mirror.

MAX/spend validation uses decimal text instead of floating-point wallet balances. SUI gas reserve subtraction is also decimal-string based.

## Quote verification

HTTP JSON is untrusted even when TypeScript declares a type. Signed quote verification now runtime-validates:

- identifiers and timestamps;
- Sui coin types and fee recipient;
- exact gross/net/fee base-unit arithmetic;
- service-fee BPS and exact fee calculation;
- slippage and price-impact limits;
- routing mode;
- transaction deadline.

Expired unsigned quotes are also rejected when deployments intentionally run without quote signing.

## Gas display

Simulated Sui gas is formatted from exact MIST base units rather than converting the MIST integer through JavaScript floating point.

## Immediate wallet refresh

Confirmed transactions and realtime wallet events now invalidate the short wallet cache and trigger an immediate balance refresh, avoiding a stale Swap balance for up to the previous 15-second polling interval.

## Protected submission endpoint is now real

`SUI_PROTECTED_RPC_URL`, when configured, is now used as the gRPC-compatible transaction **submission** endpoint rather than merely changing UI text. Reads, indexing, and ordinary simulation continue to use `SUI_GRPC_URL`; final execution uses the protected endpoint after independently verifying that it reports the configured Sui network. If no protected endpoint is configured, execution falls back to the primary gRPC URL.

## Source-package hygiene

The stale `tsconfig.tsbuildinfo` compiler cache was removed from the distributable source archive and `*.tsbuildinfo` is now ignored. Build caches are environment-specific and should not be treated as release source.
