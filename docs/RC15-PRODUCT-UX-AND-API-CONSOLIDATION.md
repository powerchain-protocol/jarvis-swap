# JARVIS Swap rc.15 — Product UX and API consolidation

Version remains `1.0.0-rc.15`.

## Changes

- Client quote, token import, wallet, portfolio, activity, and transaction-status calls now share canonical `/api/v1` route constants.
- Legacy `/api/quote`, `/api/tokens/resolve`, and `/api/swap/config` routes remain compatibility aliases and advertise their successor endpoints through deprecation/link response headers.
- Added reusable accessible loading, empty, and error states for data-heavy workspaces.
- Activity now formats Sui gas in SUI rather than exposing raw MIST, removes inline-layout styling, and rejects stale overlapping page requests.
- Portfolio refreshes are request-ordered and realtime refresh bursts are coalesced to avoid stale data overwriting a newer wallet snapshot.
- Tokens now expose loading/error/empty states, owned-asset result counts, bounded request ordering, and request cancellation on wallet changes.
- Transaction filters are responsive and no longer rely on inline layout styles.

## Invariants

Sui remains authoritative for balances and transaction finality. Portfolio/database state is an index/cache only. Swap execution still requires signed quote integrity, simulation, sender/signature verification, idempotent submission, and finality confirmation. The service-fee maximum remains 250 bps (2.5%).
