# RC15 execution-policy fingerprint

JARVIS Swap binds every signed swap quote to a deterministic, secret-free SHA-256 fingerprint of the deployment policy that is allowed to execute it.

The fingerprint covers the active Sui network, release, service-fee basis points and recipient, on-chain fee requirement, published Move package/config object identifiers when configured, slippage and price-impact caps, trusted-token registry identity, canonical configured token types, and the allowed Cetus provider set.

It deliberately excludes signing/session secrets, API keys, database URLs, RPC URLs, cookies, wallet-session material, and other credentials.

## Why this exists

During a rolling Mainnet deployment, two healthy application instances can briefly run different configuration. A quote issued by instance A must not be accepted by instance B if the material execution policy changed. The quote now contains `policyFingerprint`, the value is covered by the HMAC signature, and both quote verification and transaction execution fail with a conflict when the local policy fingerprint differs.

This protects changes such as:

- service-fee recipient rotation;
- fee basis-point changes;
- Move fee-enforcement package/config rotation;
- canonical token-type changes;
- trusted-token registry changes;
- slippage/price-impact policy changes;
- Cetus provider-policy changes.

Clients also compare the quote fingerprint with `/api/v1/swap/config` before constructing the PTB, allowing a stale quote to fail before wallet signing.

`/api/v1/deployment/status` exposes only the fingerprint itself so operators can detect mixed-policy instances without exposing the underlying secret configuration.
