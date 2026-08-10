# JARVIS Swap fee module

This Move package provides the optional on-chain enforcement layer for the JARVIS Swap service fee.

`swap::collect_fee<T>` accepts one gross input coin, validates the shared `Config`, transfers the configured service fee to the configured recipient, emits `FeeCollected<T>`, and returns the net coin so the same PTB can pass it directly into Cetus.

The function also receives `expected_fee_bps` and `expected_fee_recipient`. These values are copied from the reviewed, signed quote. If the shared fee configuration changes after the quote was issued but before the user signs/executes, the transaction aborts instead of silently applying a different fee policy.

Production policy can set `JARVIS_REQUIRE_ONCHAIN_FEE=true` so the browser refuses to execute swaps until `JARVIS_SWAP_PACKAGE_ID` and `JARVIS_SWAP_CONFIG_OBJECT_ID` are configured.

The TypeScript atomic split/transfer path remains a migration fallback only. For mainnet, publish and audit this package, configure the shared object ID, validate the AdminCap custody model, and enable the on-chain requirement.
