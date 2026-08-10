import { existsSync, readFileSync } from 'node:fs';
import process from 'node:process';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const major = Number(process.versions.node.split('.')[0]);
if (major < 22) throw new Error(`Node.js >=22 is required; found ${process.version}.`);

const required = [
  'node_modules/.bin/next',
  'node_modules/.bin/tsc',
  'node_modules/.bin/eslint',
  'node_modules/.bin/prisma',
];
const missing = required.filter((p) => !existsSync(p) && !existsSync(`${p}.cmd`));
if (missing.length) {
  throw new Error(`Installed dependency tree is incomplete. Missing: ${missing.join(', ')}. Run \`corepack pnpm install --frozen-lockfile\` in CI or \`corepack pnpm install\` locally.`);
}

console.log(`Toolchain ready: Node ${process.version}; package ${pkg.name}@${pkg.version}.`);
