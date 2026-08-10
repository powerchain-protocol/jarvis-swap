# JARVIS Swap rc.6 — execution safety improvements

rc.6 tightens the user-facing execution lifecycle without weakening any existing Sui/Cetus checks.

## Added

- SUI MAX now keeps a configurable gas reserve (`SUI_GAS_RESERVE_MIST`, default 20,000,000 MIST).
- Wallet-local transaction history records submitted and confirmed transaction digests rather than displaying fabricated recent activity.
- Recent swaps and Activity use the real transaction digest and SuiVision explorer URL.
- `/api/v1/ready` validates fee policy, optional signed-quote/on-chain-fee requirements, and Sui network connectivity.
- `JARVIS_ACTIVITY_MAX_ITEMS` bounds browser-local activity retention.
- API specification and source-layout validation include the readiness and history layers.

## Invariants preserved

- 2.5% is the deployment maximum service fee.
- Quote fee amount/recipient and slippage remain bound into quote-integrity verification.
- A submitted transaction is never presented as confirmed until Sui confirmation succeeds.
- JARVIS remains canonical on Sui; no Solana-native claim is introduced.
