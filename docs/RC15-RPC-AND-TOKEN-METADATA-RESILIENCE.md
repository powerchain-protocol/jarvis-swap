# RC15 RPC and trusted-token metadata resilience

Version remains `1.0.0-rc.15`.

## RPC pool quality

The Sui gRPC read pool now exposes an aggregate state (`cold`, `healthy`, `degraded`, or `critical`) derived from endpoint observations. The status payload includes healthy/quarantined counts, the preferred endpoint host and its EWMA latency, plus a server-side `checkedAt` timestamp. Endpoint secrets, paths and query parameters are never returned.

## Trusted-token metadata hydration

The trusted-token registry still establishes trust only from the active Sui network and canonical exact coin type. A new server-only hydration layer fetches on-chain coin metadata with bounded concurrency and a five-minute cache so trusted-list responses do not report operator fallback decimals as if they were observed on-chain values.

On-chain metadata can enrich display name, decimals and HTTPS icon URL, but it can never add a token to the trusted registry or change its trusted coin type.

The trusted-token endpoint now includes a representation ETag. Clients may revalidate with `If-None-Match` and receive `304 Not Modified` without downloading the same registry representation again.
