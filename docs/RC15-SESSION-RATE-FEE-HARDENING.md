# RC15 session, rate and fee hardening

Version remains `1.0.0-rc.15`.

## Wallet-session origin binding
Wallet challenges and authenticated session claims now include the canonical application origin derived from `NEXT_PUBLIC_APP_URL`. A challenge signed for one JARVIS deployment cannot be accepted by another deployment with a different origin, even when the same Sui network is selected. Production wallet sessions require an HTTPS application origin; localhost HTTP remains permitted for development.

## Exact quote rate derivation
Swap rates shown to users are now derived from exact bigint base units. The quote API no longer converts the user's source decimal amount to JavaScript `Number` to calculate the displayed route rate. Floating point remains presentation-only after a bounded bigint ratio has been calculated.

## Fee summary
The reusable fee breakdown can now expose total SUI wallet debit after simulation. For a SUI-input trade this is gross SUI input plus Sui network gas; the 2.5% service fee remains carved out of gross input. For a non-SUI input, only Sui gas is added to SUI wallet debit.

The service-fee wallet remains TBA and execution stays fail-closed until `JARVIS_SWAP_FEE_WALLET` is configured with a valid non-zero Sui address.
