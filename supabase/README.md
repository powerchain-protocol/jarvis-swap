# Supabase

Use Supabase as an optional managed PostgreSQL/Auth/API host. Migrations under `supabase/migrations` match the Prisma data model. RLS is enabled on all JARVIS Swap tables and no direct `anon` or `authenticated` table policies are granted by default.

Use the publishable key only for browser/SSR auth. `SUPABASE_SECRET_KEY` is server-only.
