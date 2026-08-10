import { readFileSync } from "node:fs";

const deployment = readFileSync("src/services/system/deployment.ts", "utf8");
const ready = readFileSync("src/app/api/v1/ready/route.ts", "utf8");
const cetus = readFileSync("src/services/cetus/aggregator.ts", "utf8");
const build = readFileSync("scripts/build-production.mjs", "utf8");
const env = readFileSync("scripts/validate-env.mjs", "utf8");

for (const [ok, message] of [
  [deployment.includes("readinessRequireSwap"), "Deployment readiness must separate application readiness from swap readiness."],
  [deployment.includes("swapReady"), "Deployment status must expose swapReady."],
  [ready.includes("getDeploymentStatus"), "/ready must consume deployment-level readiness."],
  [cetus.includes("isCetusTestnetProvider"), "Cetus Testnet provider restrictions must remain enforced."],
  [build.includes("validate-deployment-profile.mjs"), "Production build must validate the selected network deployment profile."],
  [env.includes("Mainnet production requires JARVIS_REQUIRE_SIGNED_QUOTES=true"), "Mainnet strict environment validation must require signed quotes."],
  [env.includes("Mainnet production requires JARVIS_REQUIRE_WALLET_SESSION=true"), "Mainnet strict environment validation must require wallet sessions."],
]) {
  if (!ok) throw new Error(message);
}

console.log("Deployment readiness invariants passed.");
