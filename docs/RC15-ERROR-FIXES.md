# JARVIS Swap rc.15 — error-fix pass

This hardening pass intentionally keeps the application version at `1.0.0-rc.15`.

## Fixed

- Removed the fabricated `0.0012 SUI` network-fee value from the live quote API. Gas is transaction-specific and is displayed only after signed-transaction simulation.
- Added bounded JSON parsing to the quote endpoint to prevent oversized request bodies from bypassing the shared action parser.
- Corrected rate-limit policy headers so `w=` represents the configured rate-limit window rather than the seconds remaining in the current bucket.
- Added standard no-store / nosniff API response helpers and applied them to portfolio and token-search routes.
- Removed unsafe `any` construction from custom-token search results and normalized the owner address before portfolio lookup.
- Preserved the original case of pasted Move coin types during exact token discovery. Search matching remains case-insensitive, while chain identifiers are no longer mutated before RPC metadata lookup.
- Added explicit metadata shape validation and HTTPS-only remote token icon acceptance.
- Fixed portfolio history to return the most recent 180 snapshots in chronological order. The old ascending `take: 180` query could permanently return the oldest snapshots once history exceeded the limit.
- Added bounded concurrency for portfolio metadata/price valuation so wallets with many assets do not create an unbounded burst of upstream provider requests.
- Added short-lived server price caching with in-flight request deduplication.
- Bounded the shared in-memory cache and added expired/LRU-style pruning to prevent indefinite server-process memory growth.
- Added network to the server portfolio cache key to prevent cross-network cache reuse in long-lived development/test processes.

## Build status

Repository source validators and production invariants pass. A global TypeScript diagnostic run was also used to inspect the edited files; remaining diagnostics for these files are unresolved imports for Next.js/Node types because this sandbox does not contain the repository dependency tree. No new strict-TypeScript diagnostics remain in the edited portfolio/token/price modules beyond missing external dependency resolution.

The deterministic install → Prisma generate → typecheck → lint → Next build pipeline remains the authoritative dependency-backed CI check.
