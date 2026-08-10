# RC15 Operational Swap Kill Switch

JARVIS Swap now has an operator-controlled, server-side emergency switch:

```env
JARVIS_SWAP_OPERATIONS_ENABLED=true
```

Set it to `false` to stop new swap quotes, swap transaction preflight, and swap transaction execution without disabling wallet connectivity, Send, Receive, portfolio reads, RPC diagnostics, or other non-swap surfaces.

## Why this exists

A production deployment needs a fast fail-closed control for incidents involving liquidity routing, fee configuration, upstream compromise, protocol maintenance, or an unexpected chain/provider condition. Relying only on a frontend button is insufficient because direct API callers could bypass it.

The switch is therefore enforced at the server boundaries that matter:

- `POST /api/v1/swap/quote`
- `POST /api/v1/transactions/preflight` when swap persistence/quote proof is present
- `POST /api/v1/transactions/execute` when swap persistence/quote proof is present

Non-swap Send/Receive transactions remain available because those requests do not carry swap persistence metadata.

## Runtime behavior

Disabled swap operations return HTTP `503` with a bounded public message and `Retry-After`. The public swap config and deployment status expose the disabled state without exposing secrets.

Mainnet readiness also reflects the switch. If `JARVIS_READINESS_REQUIRE_SWAP=true`, disabling swap operations makes swap readiness fail closed. Operators can intentionally set that readiness policy according to their load-balancer/deployment strategy.

## Profiles

- Mainnet example: enabled by default, but operators can flip it off during an incident.
- Testnet example: enabled by default.
- Devnet example: disabled because Cetus swap execution is not supported by this deployment profile; Send/Receive remains available.

The setting is server-controlled. It must not be writable from the browser.
