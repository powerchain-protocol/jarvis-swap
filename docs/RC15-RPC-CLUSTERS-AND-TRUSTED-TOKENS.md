# JARVIS Swap rc.15 — RPC, clusters and trusted tokens

## Clusters

JARVIS separates the Sui **network identity** (`mainnet`, `testnet`, `devnet`) from the RPC **cluster profile** (`mainnet`, `testnet`, `devnet`, `custom`). A custom cluster is an operator-configured gRPC endpoint that still targets one explicit Sui network. Wallet Standard signing continues to use the real `sui:<network>` chain identifier.

`SUI_GRPC_URLS` is an ordered, comma-separated read pool. JARVIS can fail over between these endpoints for read operations. Transaction submission uses the configured primary gRPC endpoint or `SUI_PROTECTED_RPC_URL` and still verifies reported network identity before execution.

## Custom RPC

Custom endpoints are deployment configuration, not arbitrary browser-provided URLs. This avoids turning server APIs into SSRF relays and prevents untrusted users from redirecting transaction simulation to their own endpoint.

For a custom profile set `NEXT_PUBLIC_SUI_CLUSTER=custom`, keep `NEXT_PUBLIC_SUI_NETWORK` set to the real Sui chain, and configure `SUI_CUSTOM_GRPC_URL` or `SUI_GRPC_URLS`.

## Trusted tokens

`src/data/trusted-token-list.ts` is the trust boundary. Trust is based on the exact Sui coin type and current Sui network. RPC metadata alone never marks a token verified. User-imported custom tokens always remain unverified.

Deployment-owned trusted types can be added with `TRUSTED_TOKEN_COIN_TYPES`, formatted as comma-separated `SYMBOL:coinType` entries. These are operator-controlled values and should be code-reviewed before Mainnet deployment.
