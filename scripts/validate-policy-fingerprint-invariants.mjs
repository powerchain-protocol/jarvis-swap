import fs from "node:fs";

const read = (p) => fs.readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const policy = read("src/services/system/policy-fingerprint.ts");
const integrity = read("src/services/quotes/integrity.ts");
const quoteRoute = read("src/app/api/v1/swap/quote/route.ts");
const configRoute = read("src/app/api/v1/swap/config/route.ts");
const deployment = read("src/services/system/deployment.ts");
const client = read("src/services/transactions/execute.ts");

const checks = [
  [policy.includes('createHash("sha256")'), "policy fingerprint must use SHA-256"],
  [policy.includes("trustedTokenRegistryId"), "policy fingerprint must bind trusted-token registry"],
  [policy.includes("feeRecipient"), "policy fingerprint must bind service-fee recipient"],
  [policy.includes("requireOnchainFee"), "policy fingerprint must bind on-chain fee policy"],
  [!policy.includes("quoteSigningSecret") && !policy.includes("sessionSecret") && !policy.includes("ApiKey"), "policy fingerprint must not include secrets/API keys"],
  [integrity.includes("policyFingerprint: string"), "signed quote claims must contain policy fingerprint"],
  [integrity.includes("claims.policyFingerprint !== getExecutionPolicyFingerprint()"), "server quote verification must reject policy drift"],
  [quoteRoute.includes("policyFingerprint: getExecutionPolicyFingerprint()"), "quote creation must bind current policy fingerprint"],
  [configRoute.includes("policyFingerprint: getExecutionPolicyFingerprint()"), "public swap config must expose current fingerprint"],
  [deployment.includes("policyFingerprint: getExecutionPolicyFingerprint()"), "deployment status must expose current fingerprint"],
  [client.includes("request.quoteProof.policyFingerprint !== config.policyFingerprint"), "client must reject stale-policy quote before PTB construction"],
];

const failed = checks.filter(([ok]) => !ok);
if (failed.length) {
  for (const [, message] of failed) console.error(`FAIL: ${message}`);
  process.exit(1);
}
console.log(`PASS: ${checks.length} execution-policy fingerprint invariants`);
