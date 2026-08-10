# RC15 — Server-authoritative token denominations

JARVIS Swap must never use browser-provided token decimals as an authority for financial math. A stale, malicious, or incorrectly imported token definition could otherwise change the meaning of a human-readable amount before it is converted to base units.

## Quote invariant

For every quote, the server now resolves `payCoinType` and `receiveCoinType` through Sui coin metadata and obtains the authoritative decimal precision before calling `decimalToBaseUnits()`. The browser still supplies decimals as a freshness hint. If the browser value differs from Sui metadata, the quote returns `409 Conflict` and the UI must refresh token metadata.

The server-resolved `payDecimals` and `receiveDecimals` are included in the signed quote claims. This binds the reviewed denomination to the HMAC proof and prevents a later transaction builder from interpreting the same decimal text under a different token precision.

## Security result

A request that claims `1 SUI` while substituting `decimals=0` can no longer create a quote for one MIST. The server resolves SUI as 9 decimals and rejects the stale/malicious client metadata before route construction.

Exact base-unit amounts remain authoritative for service fees, minimum received, routing, persistence, simulation validation, and execution.
