import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const frozen = existsSync('pnpm-lock.yaml');
const args = ['pnpm', 'install', frozen ? '--frozen-lockfile' : '--no-frozen-lockfile'];
if (!frozen) {
  console.warn('pnpm-lock.yaml is not present; installing without frozen-lockfile. Commit the generated lockfile before the production release candidate is promoted to stable.');
}
const result = spawnSync('corepack', args, { stdio: 'inherit', shell: false });
process.exit(result.status ?? 1);
