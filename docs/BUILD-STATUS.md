# Build status — 1.0.0-rc.15

## Source/package checks performed in the packaging runtime

- Node.js runtime detected: 22.16.0.
- `scripts/validate-source.mjs`: passed.
- `package.json`: valid JSON.
- `vercel.json`: valid JSON.
- Build/Prisma scripts parse as JavaScript.
- The production builder correctly fails early when the installed dependency tree is absent.

## Dependency-backed build status

A complete dependency-backed build is **not certified by this packaging runtime**. DNS resolution for `registry.npmjs.org` is unavailable, so Corepack/pnpm cannot install Next.js, React, Prisma, Sui, Cetus, Supabase, ESLint, and their type dependencies here.

This release addresses that limitation in the repository itself:

1. `node scripts/install-deps.mjs`
2. `corepack pnpm prisma:generate`
3. `corepack pnpm build:ci`

Once run in a network-enabled CI environment, `build:ci` performs Prisma generation, Prisma schema validation, TypeScript checking, ESLint, and `next build` and fails on any unsuccessful stage.

The generated Prisma client remains intentionally uncommitted and is rebuilt from `prisma/schema.prisma` during install/build.
