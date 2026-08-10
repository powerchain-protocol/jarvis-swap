# RC15 environment and build gates

JARVIS Swap separates **structural environment validation** from **production execution validation**.

## Structural validation

```bash
pnpm validate:env
```

This validates network/cluster names, endpoint URL shapes, numeric bounds, coin types, database URL syntax, provider settings, and secret lengths when values are present. Missing deployment-only values such as the TBA service-fee wallet are reported as warnings rather than making the source template unusable.

Use this mode for local development, source CI, and configuration editing before production secrets are provisioned.

## Production validation

```bash
pnpm validate:env:production
```

Production validation is fail-closed. It requires every value needed by an enabled security or execution feature, including:

- `JARVIS_SWAP_FEE_WALLET` when the service fee is non-zero;
- quote signing secret when signed quotes are required;
- wallet-session secret and canonical app URL when authenticated sessions are required;
- Move package/config IDs when on-chain fee enforcement is required;
- `DATABASE_URL` when durable persistence is enabled;
- a dedicated Mainnet gRPC provider when the dedicated-RPC gate is enabled.

`pnpm build:production` and the Vercel build path run this strict production validation before `next build`.

This prevents two opposite failure modes: local development no longer fails simply because production addresses are intentionally TBA, while a production deployment cannot silently build with those values missing.
