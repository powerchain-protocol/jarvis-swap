# RC15 quote-integrity hardening

This pass keeps the application version at `1.0.0-rc.15` and strengthens the reviewed-quote boundary.

## Signed price-impact claim

`priceImpactBps` is now part of the HMAC-signed quote claims. The transaction builder rejects a client request when the reviewed price impact or the user's maximum price-impact setting differs from the signed server quote.

The signed quote now binds:

- source and destination coin types
- gross and net input base units
- minimum output base units
- exact service-fee base units and BPS
- service-fee recipient
- slippage BPS
- maximum price-impact BPS
- observed quote price-impact BPS
- issued/expiry timestamps

## Same-asset swap rejection

Both the quote boundary and transaction builder reject a swap when the normalized pay and receive coin types are identical. This avoids needless router calls and prevents malformed UI state from creating a self-swap transaction.

## Structured client errors

Transaction preflight/execution clients now understand the API's structured `{ error: { code, message } }` response shape. User-visible errors therefore preserve the server's safe public message instead of collapsing into `[object Object]`.

## Exact decimal request preservation

The browser quote client now sends the user's decimal amount text directly to the server. It no longer converts the amount through JavaScript `Number` before quoting. Base-unit conversion therefore occurs once, server-side, with integer-safe logic.

The quote response is also runtime-validated before the UI accepts it; malformed upstream/API payloads are rejected instead of being trusted through a TypeScript cast.
