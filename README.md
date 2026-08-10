# JARVIS Swap

JARVIS Swap `1.0.0-rc.15` is a production-oriented Next.js App Router interface for Sui-first trading, Cetus routing, liquidity-pool discovery, token discovery, bridge UX, analytics, activity, and Wallet Standard transaction signing.

## Brand rule

The supplied white/silver/blue JARVIS helmet is copied byte-for-byte into `public/brand/jarvis-logo-light.jpeg` and is used as the JARVIS brand/token identity. The application does not redraw or approximate the helmet.


## What improved in rc.15

- Made Prisma Client generation a required production-build input instead of an undocumented manual prerequisite.
- Added `scripts/prisma-generate.mjs` with a build-only placeholder datasource so code generation does not require a live PostgreSQL connection.
- Added `build:production`, `build:ci`, `toolchain:check`, and `install:deps` workflows.
- Added early dependency-tree verification for Next.js, TypeScript, ESLint, and Prisma binaries.
- Added Vercel `installCommand` and `buildCommand` so production deployments generate Prisma before `next build`.
- Added lockfile-aware installation: frozen installs are used automatically once `pnpm-lock.yaml` exists.
- Updated runtime/API/OpenAPI version markers to `1.0.0-rc.15`.
- Added `docs/BUILD-AND-PRISMA.md` with local, CI, Vercel, migration, and generated-client rules.

## What improved in rc.13

- Migrated configured Cetus pool object reads to Sui gRPC/Core `getObjects`, removing the new pool accounting path's dependency on deprecated JSON-RPC object reads.
- Added normalized Cetus CLMM position accounting with pool ID, tick range, current tick, raw liquidity, fee/reward fields, and explicit in-range/out-of-range/unknown status.
- Upgraded the Pool UI with responsive Explore Pools / My Positions views, live refresh, realtime/finality invalidation, range metrics, and mobile-friendly position cards.
- Added `LiquidityPoolSnapshot` and `LiquidityPositionSnapshot` persistence plus synchronized Prisma/Supabase/SQL migrations.
- Added a cron-protected pool snapshot job and hourly Vercel schedule.
- Added pool-action intent validation and pool allowlisting while keeping transaction construction fail-closed until the audited Cetus execution adapter is enabled.
- Removed the previous fake add-liquidity ratio estimator from the Pool page. No LP token amount or USD valuation is fabricated.

## What improved in rc.4

- Added versioned `/api/v1` endpoints and OpenAPI/Swagger YAML.
- Added Sui RPC failover, timeout/retry logic, network status and reference-gas reporting.
- Added connected-wallet balance hydration and periodic refresh.
- Added server-side Pyth, Birdeye, CoinMarketCap and CoinGecko price adapters with ordered fallback.
- Added stricter slippage, quote-expiry, maximum-price-impact and execution-protection controls.
- Added Cetus pool object parsing and v1 pool API.
- Added `contracts/swap` Move package with a hard 250-bps fee cap and atomic fee splitter.
- Bound the direct PTB fee and Cetus swap to one gross input coin intent.

## What improved in rc.3

- Replaced the fail-closed swap execution stub with a live Sui Wallet Standard signing path.
- Integrated Cetus Aggregator V3 route discovery and `routerSwapWithMaxAmountIn` execution.
- Added an atomic 2.50% JARVIS service-fee transfer in the input asset plus the net Cetus swap in the same Sui PTB.
- Added server-side fee-bps and fee-wallet validation with zero-address rejection.
- Added exact base-unit fee arithmetic to avoid floating-point token accounting.
- Added pre-sign route refresh and reviewed minimum-output validation.
- Added SUI, JARVIS, USDC and configurable CCT coin-type support.
- Added `env/` mainnet/testnet profiles and `pnpm validate:env`.
- Added `/api/sui/status`, `/api/swap/config`, and `/api/pools`.
- Added configured Cetus CLMM pool-object discovery/validation while keeping liquidity-position execution fail-closed until tick/range parameters are provided.
- Added zk/zkLogin architecture notes without introducing a custom unaudited zkSNARK circuit.
- Upgraded to current Sui/Cetus SDK package lines documented in August 2026.


## What improved in rc.2

- Moved quote acquisition behind a server-side `/api/quote` boundary instead of calling the demo quote adapter directly from the browser.
- Added strict quote request validation for supported pairs, amount bounds, slippage bounds, and routing modes.
- Added quote IDs, 30-second expiry, visible freshness countdown, automatic quote refresh, and expiry checks before review/confirmation.
- Added abortable/debounced quote requests to prevent stale responses from racing newer user input.
- Persisted swap settings and safely imported custom tokens locally between sessions. User-imported tokens remain unverified.
- Added Wallet Standard `standard:events` account-change handling so account switches/disconnects are reflected without stale wallet state.
- Added security response headers: frame denial, MIME sniff protection, strict referrer policy, restricted browser permissions, COOP popup compatibility, and same-origin resource policy.
- Added application loading, error, and 404 states with transaction-safe wording.
- Corrected the project `check` script to use the pinned pnpm workflow.
- Kept transaction execution fail-closed; rc.2 still does not simulate or report a successful on-chain trade.

## What improved in rc.1

- Light theme remains the default; dark mode is now a restrained dark-blue system with explicit action tokens.
- Centered top navigation and sidebar now show active-route state.
- Responsive mobile navigation, wallet sheet, token sheet, and full-height mobile review flow.
- Wallet Standard provider discovery now filters for Sui-compatible providers and supports best-effort silent reconnect to the last connected wallet.
- Connected wallet button now opens an account menu with copy-address and disconnect actions instead of immediately disconnecting.
- Swap quoting is pair-aware, slippage-aware, validates balance/amounts, swaps token sides safely, and visibly labels demo quotes.
- The swap primary action requires wallet connection and never fakes an on-chain confirmation.
- Review flow fails closed until an audited transaction adapter is wired. No transaction is submitted by the scaffold.
- Token selector supports search by symbol/name/coin type, verification labels, and safe custom-token import.
- Custom token metadata resolution now validates coin-type input, enforces a timeout, bounds returned metadata, and never marks imported assets as verified.
- Settings now support slippage, deadline, routing preference, and expert-mode state.
- Limit and DCA surfaces are present but execution remains disabled until the strategy service exists.
- Pool includes a responsive add-liquidity estimator while execution is disabled until a pool adapter is configured.
- Token table collapses to cards on mobile.
- Bridge copy strictly preserves the canonical model: JARVIS is canonical on Sui and the Solana asset is bridged.
- Analytics uses a restrained no-gradient SVG chart and responsive metric cards.
- Activity provides explicit explorer links.
- Added `/api/health`, `.env.example`, app manifest, exact supplied app icon, and ESLint flat config.
- Added an explicit `src/services/transactions/execute.ts` fail-closed production boundary.

## Install

```bash
corepack enable
corepack prepare pnpm@11.20.0 --activate
pnpm install
pnpm dev
```

Recommended runtime: Node.js 22+; project metadata pins pnpm `11.20.0`.

## Build and validation

Prisma Client generation is now part of the production build contract. After installing dependencies, run:

```bash
corepack pnpm build:production
```

For the full CI gate (Prisma generate + Prisma schema validation + TypeScript + ESLint + Next.js production build):

```bash
corepack pnpm build:ci
```

Vercel is configured to install with a frozen lockfile and run the same production builder. See `docs/BUILD-AND-PRISMA.md`.

The archive-packaging runtime itself has no DNS access to `registry.npmjs.org`, so it cannot install this repository's dependency tree and therefore cannot truthfully certify the dependency-backed build in this environment. The project now fails early with a precise toolchain error instead of silently skipping Prisma generation or claiming a build passed.

## Production wiring

The UI is deliberately conservative at transaction boundaries. `src/services/quotes/mock.ts` is demo-only. Before enabling real swaps, replace it with a server-validated quote adapter and implement `src/services/transactions/execute.ts` using audited Sui transaction construction/signing logic.

A production route should bind a reviewed quote to at least: sender, input coin type, output coin type, exact input amount, minimum output, route/provider, slippage, expiry/deadline, network, and transaction bytes. Revalidate all server-derived values immediately before wallet signing/submission and verify the final on-chain result before showing `Confirmed`.

Never expose RPC API keys, aggregator credentials, bridge relayer secrets, or payout/signing material through `NEXT_PUBLIC_*` variables.

## rc.3 — live Sui/Cetus execution

This release replaces the fail-closed swap stub with a Wallet Standard transaction path using the current Sui `Transaction` API and Cetus Aggregator V3. A reviewed quote is refreshed before signing; the route must still satisfy the reviewed minimum output.

### 2.50% JARVIS service fee

`JARVIS_SWAP_SERVICE_FEE_BPS=250` means 2.50% of the **gross input asset** is transferred to `JARVIS_SWAP_FEE_WALLET`. The fee transfer and the Cetus swap are composed into one Sui programmable transaction block, so they succeed or fail atomically. Sui gas is separate and paid by the signing wallet. This application-level PTB fee is used because Cetus' overlay-fee facility has a lower protocol maximum than the requested 2.50%.

The fee recipient is mandatory whenever the fee is non-zero. The app rejects a missing, zero, or malformed Sui fee address. Put the real address in `.env.local`; never put a private key there.

### Required deployment configuration

Copy `env/.env.mainnet.example` or `env/.env.testnet.example` to `.env.local`, then configure at minimum:

- `JARVIS_SUI_COIN_TYPE`
- `JARVIS_SWAP_FEE_WALLET`
- `CCT_SUI_COIN_TYPE` if CCT trading is enabled
- `CETUS_POOL_IDS` for allowed/known CLMM pool objects
- production Sui RPC/Pyth/Cetus endpoints as appropriate

Run `pnpm validate:env` before build/deploy. `/api/sui/status` checks Sui RPC health and `/api/pools` validates configured Cetus pool object IDs.

See `docs/SUI-CETUS-INTEGRATION.md` for fee accounting, CCT, CLMM and zk/zkLogin notes.

## rc.4 — Sui network, data, API and protection layer

rc.4 adds a versioned `/api/v1` surface, `src/app/api/swagger.yaml`, Sui RPC failover/backoff, live wallet-balance fetching, server-side price-provider adapters (Pyth, Birdeye, CoinMarketCap and CoinGecko), richer Cetus pool object parsing, and a Move fee-policy package under `contracts/swap/`.

Price credentials remain server-only. Provider ordering is controlled by `PRICE_PROVIDER_ORDER`, and unavailable providers fall through instead of silently fabricating a price. Configure verified Pyth feed IDs, CoinMarketCap IDs and CoinGecko IDs in environment variables. Pyth API-key support is included now because Hermes authentication is scheduled to become required for the public production endpoint in August 2026.

The Sui query adapter accepts multiple `SUI_RPC_URLS` endpoints and implements timeout, retry, 429/5xx failover. This release keeps a raw JSON-RPC compatibility transport because existing wallet/data endpoints still expose those methods, but new infrastructure should prefer Sui gRPC as JSON-RPC is deprecated by Mysten. `SUI_GRPC_URL` is therefore part of the deployment configuration and is the migration target for a subsequent transport pass.

Swap protection now includes deployment-capped slippage, user-selectable maximum price impact, fresh-route enforcement, minimum-received enforcement, quote expiration, deadline validation, and an explicit MEV/execution-protection toggle. The toggle does not claim private order flow: without `SUI_PROTECTED_RPC_URL`, it means strict client/route protections only.

The 2.5% service fee is bound to one exact gross input coin intent. The PTB splits the fee from that input and routes the remainder through Cetus, preserving atomic rollback. The optional Move package exposes the same 250-bps maximum policy and can become the audited on-chain policy boundary after deployment/package-ID pinning.

Useful endpoints:

- `GET /api/v1/health`
- `GET /api/v1/network/status`
- `GET /api/v1/wallet/{address}`
- `GET /api/v1/prices?symbols=SUI,JARVIS,USDC,CCT`
- `GET /api/v1/pools`
- `GET /api/v1/swap/settings`
- `POST /api/v1/swap/quote`
- `POST /api/v1/swap/validate`
- `GET /api/v1/openapi`


## rc.5 hardening

See `docs/SECURITY-AND-EXECUTION.md` for signed quote integrity, optional on-chain fee enforcement, Sui confirmation semantics, and price freshness/confidence checks.


## rc.7 hardening

- wallet signs first but does not broadcast directly
- server-side Sui gRPC simulation of the exact signed transaction bytes
- signature verification and second simulation immediately before submission
- real simulated gas surfaced to the swap UI after signing
- sender transaction feed endpoint at `/api/v1/wallet/{address}/activity`
- configurable wallet-owned Cetus position discovery at `/api/v1/pools/positions?owner=...`
- no automatic trust is assigned to a discovered position object; deployments must configure the exact audited Cetus position object type



## rc.9 responsive UI and runtime improvements

rc.9 focuses on mobile usability, deterministic formatting and a lighter client runtime. `src/hooks/mobile.ts` centralizes responsive behavioral media queries, wallet and analytics UI are lazy-loaded where appropriate, and `src/utils/cache.ts` adds short-lived request de-duplication for public price data and connected-wallet reads.

New shared boundaries include `formats.ts`, `rates.ts`, `safe-actions.ts`, `/actions.json`, domain types for fees/wallets/charts/portfolio/tokens, and `src/data/charts.ts`. The UI adds iOS safe-area support, larger touch targets, Escape-aware navigation, reduced-motion handling and narrow-device refinements. Quote, preflight and execution paths remain freshness-sensitive and are not converted into long-lived client caches.

## rc.8 database and domain hardening

rc.8 adds an optional durable PostgreSQL layer without moving blockchain truth off-chain. Prisma 7 is the typed server ORM, while Supabase can host PostgreSQL/Auth/API infrastructure. Sui remains authoritative for balances, ownership, transaction finality and Cetus state.

Repository structure:

```text
database/
  prisma/                 # lazy server client + repositories
  supabase/               # browser/SSR/admin clients
prisma/
  schema.prisma
  migrations/
supabase/
  config.toml
  migrations/
migration/
  README.md
  202608090001_init.sql
schemas/
  wallet.ts
  token.ts
  swap.ts
  pool.ts
src/utils/
  errors.ts
  currencies.ts
  helpers.ts
  tokens.ts
```

The schema persists wallets, token metadata, price observations, signed quotes, swap transactions, service-fee records, Cetus pools and liquidity positions. Base-unit amounts use `numeric(78,0)` rather than JavaScript floating point. All Supabase-facing tables enable RLS and ship without `anon`/`authenticated` table policies.

Database persistence is opt-in with `DATABASE_PERSISTENCE_ENABLED=true`. `GET /api/v1/database/status` reports whether PostgreSQL is configured and reachable.


## rc.10 realtime, RPC and deployment architecture

JARVIS Swap uses Sui gRPC as its preferred server-side network transport and retains JSON-RPC only as a configured compatibility/failover path. Browser realtime is isolated behind `RealtimeProvider`, `useWebSocket`, and a typed `RealtimeEnvelope`. Set `NEXT_PUBLIC_REALTIME_WS_URL` to a dedicated external realtime service when live push updates are required.

Vercel Functions are deliberately **not** treated as a persistent WebSocket server. On Vercel, use a serverless-friendly realtime provider or a separately hosted stream gateway and let the browser connect directly to that endpoint. On-chain Sui event ingestion should prefer gRPC event subscriptions / an indexer, then publish normalized application events through the realtime gateway.

`src/proxy.ts` is the single Next.js 16 request proxy, colocated with the `src/app` tree. It adds request correlation IDs and no-store/noindex behavior to API responses. `vercel.json` increases duration only for the transaction preflight/execution/finality routes. `next.config.ts` keeps security headers, compression, package-import optimization, and immutable caching for Next static assets.

## rc.11 — Portfolio & data layer

rc.11 adds live Sui wallet portfolio valuation, persisted price/portfolio snapshots, wallet-token discovery and virtualized token rendering, local user preferences, portfolio history ranges, transaction filtering, post-confirmation portfolio refresh, and API rate-limit/idempotency boundaries. Unknown or unpriced assets remain explicitly unverified/unpriced and are excluded from portfolio USD totals.


## rc.12 data integrity and reconciliation

- Sui wallet activity now uses Core API cursor pagination (`before`/`after`) and normalized balance changes/events.
- Transaction reconciliation re-checks submitted swaps against Sui and stores normalized observations in PostgreSQL.
- Vercel Cron endpoints are protected with `CRON_SECRET`; reconciliation runs hourly and operational cleanup daily.
- Portfolio assets expose price freshness and allocation percentages. Realtime transaction/wallet/price topics trigger targeted browser refresh events.
- PostgreSQL remains an index/cache: Sui transaction finality is authoritative.


## rc.14 production hardening

- Mainnet, Testnet, and Devnet network profiles.
- gRPC/Core is authoritative for wallet balances, token metadata, pool reads, health, simulation, execution, and confirmation.
- Mainnet profile can require a dedicated Sui gRPC provider.
- Centralized `src/config/settings.ts` for persisted swap settings and bounds.
- Canonical pool types under `src/types/pools.ts`.
- Hashed-identity server-side rate limiting with durable PostgreSQL buckets when persistence is enabled.
- Suiscan network-aware explorer helpers.
- Wallet Send / Receive actions using the same sign → simulate → idempotent execute pipeline used by swaps.

See `docs/PRODUCTION-DEPLOYMENT.md` before enabling real-value mainnet execution.


## Deployment readiness

Use `GET /api/v1/swap/readiness` for a secret-free view of swap blockers and warnings. A TBA service-fee wallet is reported as a blocker while configuration/status APIs remain readable. Quote and execution endpoints still fail closed until all required production inputs are configured.
