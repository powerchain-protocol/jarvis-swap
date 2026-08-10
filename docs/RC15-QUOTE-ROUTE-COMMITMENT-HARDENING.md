# RC15 quote route commitment hardening

Version remains `1.0.0-rc.15`.

This pass binds the reviewed quote more tightly to the deployment and route provenance. Signed quote claims now include the Sui network, exact quoted output base units, and a deterministic SHA-256 route commitment derived from network, coin types, gross/net amounts, exact output, minimum output, quote identifier, provider label, and route path.

The execution client rejects a quote created for another network and requires a valid route commitment. A fresh Cetus route must continue to use the exact reviewed net input and meet the signed minimum output before the wallet is asked to submit the signed transaction.

The route commitment is an integrity/provenance marker, not a promise that the same liquidity path will still be available at execution time. Execution still refreshes routing and enforces the signed minimum received amount.
