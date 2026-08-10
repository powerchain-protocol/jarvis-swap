# RC15 Structured Observability and Runtime Capacity

JARVIS Swap now emits bounded JSON operational events for quote creation/failure, transaction submission/failure, and best-effort persistence failures. Logs intentionally redact fields whose names indicate wallet addresses, signatures, transactions, digests, secrets, tokens, coin types, RPCs, URLs, cookies, authorization data, or keys. Raw upstream error messages are not serialized into production event records; only the error class is retained.

The proxy-provided `x-request-id` is propagated into high-value server events for correlation without logging wallet identity. Event records include service/version, timestamp, event name, safe operational fields, and request duration where applicable.

`GET /api/v1/deployment/status` now exposes current per-instance admission-control utilization for quote, portfolio, and price workloads (`active` and `queued`) alongside configured concurrency limits. This makes saturation diagnosable without exposing credentials or user data.

These runtime counters are diagnostic only; they reset with each server instance and are not a replacement for centralized metrics.
