import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { platform } from 'node:os';

const bin = platform() === 'win32' ? 'node_modules/.bin/prisma.cmd' : 'node_modules/.bin/prisma';
if (!existsSync(bin)) {
  console.error('Prisma CLI is not installed. Run `corepack pnpm install --frozen-lockfile` (CI) or `corepack pnpm install` first.');
  process.exit(2);
}

// `prisma generate` only needs a syntactically valid datasource URL; it does not
// connect to PostgreSQL. This placeholder avoids coupling code generation to a
// live database during Docker/Vercel/CI builds while migrations still require a
// real DATABASE_URL/DIRECT_URL.
const env = {
  ...process.env,
  DATABASE_URL: process.env.DATABASE_URL?.trim() || 'postgresql://build:build@127.0.0.1:5432/jarvis_build?schema=public',
};

const result = spawnSync(bin, ['generate', '--schema=prisma/schema.prisma'], {
  stdio: 'inherit',
  env,
  shell: false,
});
process.exit(result.status ?? 1);
