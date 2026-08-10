# Build and Prisma generation

JARVIS Swap treats Prisma Client generation as a required build input, not an optional manual step.

## Local development

```bash
corepack enable
corepack pnpm install
corepack pnpm prisma:generate
corepack pnpm dev
```

## Production build

```bash
node scripts/install-deps.mjs
corepack pnpm build:production
```

`build:production` verifies the installed toolchain, generates `src/generated/prisma`, validates the source layout, then runs `next build`.

## CI verification

```bash
node scripts/install-deps.mjs
corepack pnpm build:ci
```

`build:ci` performs Prisma generation + schema validation, TypeScript checking, ESLint, and a production Next.js build.

## Database URL behavior during generation

Prisma Client generation does not connect to PostgreSQL. `scripts/prisma-generate.mjs` supplies a local non-routable build placeholder only when `DATABASE_URL` is absent so Vercel/Docker/CI code generation is not coupled to a live database.

This placeholder is **never** used by migrations or runtime persistence. `prisma migrate deploy`, application database access, and persistence-enabled deployments still require a real `DATABASE_URL` (and optionally `DIRECT_URL`).

## Vercel

`vercel.json` explicitly uses:

```text
installCommand = node scripts/install-deps.mjs
buildCommand   = corepack pnpm run vercel-build
```

This makes Prisma generation deterministic before the Next.js production build.

## Generated client policy

`src/generated/prisma` remains gitignored. It is regenerated from `prisma/schema.prisma` on every dependency install/build. This prevents stale generated clients from drifting away from the committed schema.

## Lockfile note

This source archive does not contain a `pnpm-lock.yaml` because the packaging runtime cannot resolve the npm registry to create one. `install-deps.mjs` therefore uses `--no-frozen-lockfile` only when the lockfile is absent. On the first network-enabled install, commit the generated `pnpm-lock.yaml`; every subsequent CI/Vercel install will automatically switch to `--frozen-lockfile`.
