import { spawnSync } from 'node:child_process';
import { platform } from 'node:os';

const win = platform() === 'win32';
const run = (command, args, env = process.env) => {
  console.log(`\n> ${command} ${args.join(' ')}`);
  const result = spawnSync(command, args, { stdio: 'inherit', env, shell: false });
  if ((result.status ?? 1) !== 0) process.exit(result.status ?? 1);
};

run(process.execPath, ['scripts/verify-toolchain.mjs']);
run(process.execPath, ['scripts/prisma-generate.mjs']);
run(process.execPath, ['scripts/validate-source.mjs']);
run(process.execPath, ['scripts/validate-env.mjs']);

const bins = {
  tsc: win ? 'node_modules/.bin/tsc.cmd' : 'node_modules/.bin/tsc',
  eslint: win ? 'node_modules/.bin/eslint.cmd' : 'node_modules/.bin/eslint',
  prisma: win ? 'node_modules/.bin/prisma.cmd' : 'node_modules/.bin/prisma',
};

const prismaEnv = {
  ...process.env,
  DATABASE_URL: process.env.DATABASE_URL?.trim() || 'postgresql://build:build@127.0.0.1:5432/jarvis_build?schema=public',
};
run(bins.prisma, ['validate', '--schema=prisma/schema.prisma'], prismaEnv);
run(bins.tsc, ['--noEmit', '--pretty', 'false']);
run(bins.eslint, ['.']);
run(process.execPath, ['scripts/build-production.mjs']);
