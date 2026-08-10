# Database migration workflow

The canonical application model is `database/prisma/schema.prisma`. The initial SQL is mirrored into both Prisma and Supabase migration trees so either deployment workflow can be audited.

## Prisma

```bash
pnpm prisma:generate
pnpm prisma:migrate:dev
pnpm prisma:migrate:deploy
```

Use `DATABASE_URL` for the runtime connection. For Supabase, prefer the pooler for serverless runtime traffic and a direct database connection for migration tooling when your deployment setup requires it.

## Supabase CLI

```bash
pnpm supabase:start
pnpm supabase:db:reset
pnpm supabase:db:push
pnpm supabase:types
```

All JARVIS Swap tables have RLS enabled and are backend-only by default. Do not add broad `anon` policies for wallet, quote, transaction, fee, or position data. Add narrowly scoped policies only after an authenticated ownership model is defined.

Never expose `SUPABASE_SECRET_KEY`, database credentials, Prisma URLs, or fee-management credentials to the browser.
