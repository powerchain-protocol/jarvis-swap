import { spawnSync } from 'node:child_process';
import { platform } from 'node:os';
import { existsSync } from 'node:fs';

const win = platform() === 'win32';
const node = process.execPath;
const run = (command, args, env = process.env) => {
  console.log(`\n> ${command} ${args.join(' ')}`);
  const result = spawnSync(command, args, { stdio: 'inherit', env, shell: false });
  if ((result.status ?? 1) !== 0) process.exit(result.status ?? 1);
};

run(node, ['scripts/verify-toolchain.mjs']);
run(node, ['scripts/prisma-generate.mjs']);
run(node, ['scripts/validate-source.mjs']);
run(node, ['scripts/validate-production-invariants.mjs']);
run(node, ['scripts/validate-readiness-invariants.mjs']);
run(node, ['scripts/validate-lifecycle-invariants.mjs']);
run(node, ['scripts/validate-policy-fingerprint-invariants.mjs']);
run(node, ['scripts/validate-env.mjs', '--production']);
const deploymentNetwork = (process.env.NEXT_PUBLIC_SUI_NETWORK || 'mainnet').toLowerCase();
if (!['mainnet', 'testnet', 'devnet'].includes(deploymentNetwork)) throw new Error(`Unsupported NEXT_PUBLIC_SUI_NETWORK=${deploymentNetwork}.`);
run(node, ['scripts/validate-deployment-profile.mjs', `--network=${deploymentNetwork}`]);

const next = win ? 'node_modules/.bin/next.cmd' : 'node_modules/.bin/next';
if (!existsSync(next)) throw new Error('Next.js binary is missing after toolchain verification.');
run(next, ['build']);
