# RC15 Asset identity and price safety

Version remains `1.0.0-rc.15`.

## Changes

- Wallet balances are normalized to canonical Sui coin types before client-side matching.
- Wallet API payloads are runtime-validated and bounded before they enter React state.
- Price points carry the canonical requested Sui coin type when one is available.
- Market prices are applied by exact coin type first. Symbol fallback is allowed only for already trusted/verified assets.
- A user-imported token named `SUI`, `USDC`, `JARVIS`, or another trusted symbol cannot inherit that trusted asset's price merely by copying its symbol.
- The public price endpoint is rate-limited, bounds its query size, preserves short CDN caching for successful public market data, and no longer leaks detailed upstream/provider configuration errors.

## Security invariant

Asset identity is `network + canonical coin type`. Symbols, names and icons are display metadata only.
