# RC15 Server-Bound Quote Execution

JARVIS Swap transaction preflight and execution now bind swap persistence metadata to the exact server-verified quote proof.

## Why

A browser-supplied persistence object is useful for audit storage, but it must never be the authority for the reviewed swap. The authoritative execution intent is the HMAC-verified quote claim set issued by the server.

## Enforcement

For swap transactions the client submits both:

- `persistence`: the compact audit payload used by the transaction/indexing layer; and
- `quoteProof`: the exact signed quote claims plus signature.

Both `/api/v1/transactions/preflight` and `/api/v1/transactions/execute` verify the quote proof and require the persistence values to match the signed claims exactly for:

- quote ID;
- gross input base units;
- minimum output base units;
- service fee base units;
- service fee BPS;
- pay coin type; and
- receive coin type.

The verified quote must also still match the deployment's current fee BPS and service-fee recipient. An expired quote, wrong network, changed fee policy, changed fee recipient, or mismatched browser persistence payload fails closed before Sui submission.

Non-swap operations such as Send do not include swap persistence metadata and therefore do not require a quote proof.

## Execution sequence

```text
wallet-signed Sui transaction
        |
        v
strict transaction decoding
        |
        v
wallet session + transaction policy
        |
        v
server verifies signed quote proof
        |
        v
server binds audit persistence to quote claims
        |
        v
fresh Sui simulation
        |
        +--> exact 2.5% fee credit
        +--> exact receive coin type
        +--> minimum received
        |
        v
signature verification / re-simulation
        |
        v
idempotent Sui submission
```

This does not make the database authoritative over Sui. The database remains an audit/indexing layer; Sui simulation and finality remain the execution authority.
