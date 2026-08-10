# Realtime transport

`RealtimeSocket` is a browser client for a dedicated external realtime gateway. It implements reconnect with bounded exponential backoff, heartbeat frames, state reporting, malformed-frame isolation and explicit teardown.

Do not host the persistent WebSocket server inside a normal Vercel Function. For production, ingest Sui events with gRPC `SubscriptionService.SubscribeEvents` or a dedicated indexer, normalize them to `RealtimeEnvelope`, and publish them through a serverless-friendly realtime provider or separately hosted gateway.

The browser URL is `NEXT_PUBLIC_REALTIME_WS_URL`. Never place provider secret keys in that public URL or in `NEXT_PUBLIC_*` environment variables.
