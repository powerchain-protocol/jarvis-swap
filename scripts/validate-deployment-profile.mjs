const args = new Map(process.argv.slice(2).map((item) => {
  const [key, ...rest] = item.split("=");
  return [key, rest.join("=")];
}));

const expected = (args.get("--network") || "").toLowerCase();
if (!['mainnet', 'testnet', 'devnet'].includes(expected)) {
  throw new Error('Usage: node scripts/validate-deployment-profile.mjs --network=mainnet|testnet|devnet');
}

const actual = (process.env.NEXT_PUBLIC_SUI_NETWORK || '').toLowerCase();
if (actual !== expected) throw new Error(`Deployment profile expects ${expected}, but NEXT_PUBLIC_SUI_NETWORK=${actual || '<missing>'}.`);

const truthy = (value) => /^(true|1|yes)$/i.test(value || '');
const requireValue = (name) => {
  if (!process.env[name]?.trim()) throw new Error(`${name} is required for the ${expected} deployment profile.`);
};

if (expected === 'mainnet') {
  requireValue('NEXT_PUBLIC_APP_URL');
  requireValue('SUI_GRPC_URL');
  requireValue('JARVIS_SUI_COIN_TYPE');
  requireValue('JARVIS_SWAP_FEE_WALLET');
  requireValue('JARVIS_QUOTE_SIGNING_SECRET');
  requireValue('JARVIS_SESSION_SECRET');
  requireValue('JARVIS_SWAP_PACKAGE_ID');
  requireValue('JARVIS_SWAP_CONFIG_OBJECT_ID');
  if (!truthy(process.env.JARVIS_REQUIRE_SIGNED_QUOTES)) throw new Error('Mainnet requires JARVIS_REQUIRE_SIGNED_QUOTES=true.');
  if (!truthy(process.env.JARVIS_REQUIRE_WALLET_SESSION)) throw new Error('Mainnet requires JARVIS_REQUIRE_WALLET_SESSION=true.');
  if (!truthy(process.env.JARVIS_REQUIRE_ONCHAIN_FEE)) throw new Error('Mainnet requires JARVIS_REQUIRE_ONCHAIN_FEE=true.');
  if (!truthy(process.env.JARVIS_REQUIRE_DEDICATED_RPC)) throw new Error('Mainnet requires JARVIS_REQUIRE_DEDICATED_RPC=true.');
  if (!truthy(process.env.JARVIS_READINESS_REQUIRE_SWAP)) throw new Error('Mainnet requires JARVIS_READINESS_REQUIRE_SWAP=true.');
}

if (expected === 'devnet') {
  if (truthy(process.env.JARVIS_READINESS_REQUIRE_SWAP)) throw new Error('Devnet must keep JARVIS_READINESS_REQUIRE_SWAP=false because Cetus swap execution is intentionally unavailable there.');
  if (truthy(process.env.JARVIS_REQUIRE_ONCHAIN_FEE) && !process.env.JARVIS_SWAP_PACKAGE_ID?.trim()) {
    throw new Error('Devnet on-chain fee enforcement requires a Devnet Move package ID.');
  }
}

console.log(`${expected} deployment profile validation passed.`);
