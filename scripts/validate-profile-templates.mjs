import { readFileSync } from "node:fs";

function parse(path) {
  const out = new Map();
  for (const raw of readFileSync(path, "utf8").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const index = line.indexOf("=");
    if (index <= 0) continue;
    out.set(line.slice(0, index), line.slice(index + 1));
  }
  return out;
}

const mainnet = parse("env/.env.mainnet.example");
const testnet = parse("env/.env.testnet.example");
const devnet = parse("env/.env.devnet.example");

const expect = (map, key, value, profile) => {
  if (map.get(key) !== value) throw new Error(`${profile}: expected ${key}=${value}, got ${map.get(key) ?? "<missing>"}.`);
};

expect(mainnet, "NEXT_PUBLIC_SUI_NETWORK", "mainnet", "mainnet");
expect(mainnet, "JARVIS_READINESS_REQUIRE_SWAP", "true", "mainnet");
expect(mainnet, "JARVIS_REQUIRE_DEDICATED_RPC", "true", "mainnet");
expect(mainnet, "JARVIS_REQUIRE_SIGNED_QUOTES", "true", "mainnet");
expect(mainnet, "JARVIS_REQUIRE_WALLET_SESSION", "true", "mainnet");
expect(mainnet, "JARVIS_REQUIRE_ONCHAIN_FEE", "true", "mainnet");
if (!mainnet.has("JARVIS_SWAP_PACKAGE_ID") || !mainnet.has("JARVIS_SWAP_CONFIG_OBJECT_ID")) throw new Error("mainnet: Move fee deployment placeholders are missing.");

expect(testnet, "NEXT_PUBLIC_SUI_NETWORK", "testnet", "testnet");
expect(testnet, "JARVIS_READINESS_REQUIRE_SWAP", "false", "testnet");
expect(devnet, "NEXT_PUBLIC_SUI_NETWORK", "devnet", "devnet");
expect(devnet, "JARVIS_READINESS_REQUIRE_SWAP", "false", "devnet");
expect(devnet, "JARVIS_REQUIRE_DEDICATED_RPC", "false", "devnet");
expect(devnet, "JARVIS_REQUIRE_ONCHAIN_FEE", "false", "devnet");

console.log("Mainnet/Testnet/Devnet environment template intent validation passed.");
