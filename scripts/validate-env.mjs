const addressPattern = /^0x[a-fA-F0-9]{1,64}$/;
const coinTypePattern = /^0x[a-fA-F0-9]+::[A-Za-z_][A-Za-z0-9_]*::[A-Za-z_][A-Za-z0-9_]*(?:<.*>)?$/;
const truthy = (value) => /^(true|1|yes)$/i.test(value || "");
const args = new Set(process.argv.slice(2));
const strictProduction = args.has("--production") || process.env.JARVIS_ENV_VALIDATION_MODE === "production";
const warnings = [];
const warn = (message) => warnings.push(message);
const requireWhenProduction = (condition, message) => {
  if (!condition) return;
  if (strictProduction) throw new Error(message);
  warn(message);
};


const BOOLEAN_VARS = [
  "JARVIS_REQUIRE_DEDICATED_RPC",
  "JARVIS_READINESS_REQUIRE_SWAP",
  "JARVIS_SWAP_OPERATIONS_ENABLED",
  "JARVIS_MAINTENANCE_MODE",
  "JARVIS_REQUIRE_SIGNED_QUOTES",
  "JARVIS_REQUIRE_WALLET_SESSION",
  "JARVIS_REQUIRE_ONCHAIN_FEE",
  "DATABASE_PERSISTENCE_ENABLED",
  "DEEPBOOK_ENABLED",
];
for (const name of BOOLEAN_VARS) {
  const raw = process.env[name]?.trim();
  if (raw && !/^(true|false|1|0|yes|no)$/i.test(raw)) throw new Error(`${name} must be true or false.`);
}

const network = (process.env.NEXT_PUBLIC_SUI_NETWORK || "mainnet").toLowerCase();
if (!["mainnet", "testnet", "devnet"].includes(network)) throw new Error("NEXT_PUBLIC_SUI_NETWORK must be mainnet, testnet, or devnet.");
const cluster = (process.env.NEXT_PUBLIC_SUI_CLUSTER || network).toLowerCase();
if (!["mainnet", "testnet", "devnet", "custom"].includes(cluster)) throw new Error("NEXT_PUBLIC_SUI_CLUSTER must be mainnet, testnet, devnet, or custom.");
if (cluster !== "custom" && cluster !== network) throw new Error("Non-custom Sui cluster must match NEXT_PUBLIC_SUI_NETWORK.");

const swapOperationsEnabled = process.env.JARVIS_SWAP_OPERATIONS_ENABLED == null || process.env.JARVIS_SWAP_OPERATIONS_ENABLED === "" ? true : truthy(process.env.JARVIS_SWAP_OPERATIONS_ENABLED);

const readinessRequireSwap = process.env.JARVIS_READINESS_REQUIRE_SWAP == null || process.env.JARVIS_READINESS_REQUIRE_SWAP === ""
  ? network === "mainnet"
  : truthy(process.env.JARVIS_READINESS_REQUIRE_SWAP);
if (strictProduction && network === "mainnet" && !readinessRequireSwap) {
  throw new Error("Mainnet production must set JARVIS_READINESS_REQUIRE_SWAP=true.");
}

const feeBps = Number(process.env.JARVIS_SWAP_SERVICE_FEE_BPS ?? 250);
if (!Number.isInteger(feeBps) || feeBps < 0 || feeBps > 250) throw new Error("JARVIS_SWAP_SERVICE_FEE_BPS must be 0..250.");
const wallet = process.env.JARVIS_SWAP_FEE_WALLET?.trim();
requireWhenProduction(readinessRequireSwap && feeBps > 0 && !wallet, "JARVIS_SWAP_FEE_WALLET is required when swap execution is part of production readiness.");
if (wallet && (!addressPattern.test(wallet) || /^0x0+$/.test(wallet))) throw new Error("JARVIS_SWAP_FEE_WALLET must be a non-zero Sui address.");

for (const name of ["JARVIS_SUI_COIN_TYPE", "CCT_SUI_COIN_TYPE", "SUI_USDC_COIN_TYPE"]) {
  const value = process.env[name]?.trim();
  if (value && !coinTypePattern.test(value)) throw new Error(`${name} is not a valid Sui coin type.`);
}

for (const entry of (process.env.TRUSTED_TOKEN_COIN_TYPES || "").split(",").map((v) => v.trim()).filter(Boolean)) {
  const separator = entry.indexOf(":");
  if (separator <= 0 || !/^[A-Za-z0-9_-]{1,32}$/.test(entry.slice(0, separator)) || !coinTypePattern.test(entry.slice(separator + 1))) {
    throw new Error("TRUSTED_TOKEN_COIN_TYPES must use SYMBOL:0x...::module::TYPE entries.");
  }
}

for (const [name, min, max, fallback] of [
  ["SUI_RPC_TIMEOUT_MS", 1000, 30000, 8000],
  ["SUI_RPC_RETRIES", 0, 5, 2],
  ["SUI_RPC_FAILURE_THRESHOLD", 1, 10, 3],
  ["SUI_RPC_COOLDOWN_MS", 1000, 300000, 15000],
  ["CETUS_QUOTE_TIMEOUT_MS", 1000, 30000, 8000],
  ["JARVIS_MAX_SLIPPAGE_BPS", 1, 5000, 1000],
  ["JARVIS_MAX_PRICE_IMPACT_BPS", 10, 5000, 300],
  ["JARVIS_MIN_QUOTE_VALIDITY_MS", 1000, 30000, 5000],
  ["SUI_TRANSACTION_WAIT_TIMEOUT_MS", 5000, 120000, 60000],
  ["JARVIS_MAX_GAS_BUDGET_MIST", 10000000, 20000000000, 2000000000],
  ["PRICE_MAX_STALENESS_MS", 1000, 600000, 60000],
  ["PYTH_MAX_CONFIDENCE_BPS", 1, 5000, 500],
  ["API_RATE_LIMIT_WINDOW_MS", 1000, 3600000, 60000],
  ["API_QUOTE_CONCURRENCY", 1, 100, 12],
  ["API_PORTFOLIO_CONCURRENCY", 1, 100, 8],
  ["API_PRICE_CONCURRENCY", 1, 200, 16],
  ["API_REQUEST_QUEUE_LIMIT", 0, 500, 32],
  ["API_REQUEST_QUEUE_WAIT_MS", 100, 30000, 2000],
  ["UPSTREAM_FAILURE_THRESHOLD", 1, 20, 4],
  ["UPSTREAM_COOLDOWN_MS", 1000, 300000, 15000],
  ["API_IDEMPOTENCY_TTL_MS", 60000, 604800000, 86400000],
  ["API_IDEMPOTENCY_LOCK_TTL_MS", 5000, 300000, 60000],
  ["JARVIS_SESSION_TTL_MS", 300000, 604800000, 43200000],
  ["JARVIS_SESSION_CHALLENGE_TTL_MS", 30000, 600000, 120000],
  ["JARVIS_READINESS_TIMEOUT_MS", 1000, 30000, 5000],
]) {
  const value = Number(process.env[name] ?? fallback);
  if (!Number.isInteger(value) || value < min || value > max) throw new Error(`${name} must be ${min}..${max}.`);
}

const rpcUrls = (process.env.SUI_RPC_URLS || process.env.SUI_RPC_URL || "").split(",").map((v) => v.trim()).filter(Boolean);
for (const url of rpcUrls) {
  try { const parsed = new URL(url); if (parsed.protocol !== "https:") throw new Error(); } catch { throw new Error("Every SUI_RPC_URLS entry must be an HTTPS URL."); }
}

const grpcUrls = (process.env.SUI_GRPC_URLS || (cluster === "custom" ? process.env.SUI_CUSTOM_GRPC_URL : process.env.SUI_GRPC_URL) || "").split(",").map((v) => v.trim()).filter(Boolean);
if (cluster === "custom" && grpcUrls.length === 0) throw new Error("Custom Sui cluster requires SUI_CUSTOM_GRPC_URL or SUI_GRPC_URLS.");
for (const raw of grpcUrls) {
  try {
    const parsed = new URL(raw);
    if (parsed.username || parsed.password) throw new Error();
    if (network === "mainnet" && parsed.protocol !== "https:") throw new Error();
    if (!["https:", "http:"].includes(parsed.protocol)) throw new Error();
  } catch { throw new Error("Sui gRPC endpoints must be valid HTTP(S) URLs without URL-embedded credentials; Mainnet requires HTTPS."); }
}

const protectedRpc = process.env.SUI_PROTECTED_RPC_URL?.trim();
if (protectedRpc) {
  try {
    const parsed = new URL(protectedRpc);
    if (parsed.username || parsed.password) throw new Error();
    if (network === "mainnet" && parsed.protocol !== "https:") throw new Error();
    if (!["https:", "http:"].includes(parsed.protocol)) throw new Error();
  } catch { throw new Error("SUI_PROTECTED_RPC_URL must be a valid HTTP(S) URL without embedded credentials; Mainnet requires HTTPS."); }
}

const customLabel = process.env.NEXT_PUBLIC_SUI_CUSTOM_RPC_LABEL?.trim();
if (customLabel && (customLabel.length > 64 || /[\u0000-\u001f\u007f]/.test(customLabel))) throw new Error("NEXT_PUBLIC_SUI_CUSTOM_RPC_LABEL must be a printable label of at most 64 characters.");

const quoteSecret = process.env.JARVIS_QUOTE_SIGNING_SECRET?.trim();
const requireSignedQuotes = truthy(process.env.JARVIS_REQUIRE_SIGNED_QUOTES);
requireWhenProduction(requireSignedQuotes && !quoteSecret, "JARVIS_QUOTE_SIGNING_SECRET is required when JARVIS_REQUIRE_SIGNED_QUOTES=true.");
if (quoteSecret && quoteSecret.length < 32) throw new Error("JARVIS_QUOTE_SIGNING_SECRET must be at least 32 characters; use a high-entropy secret in production.");

const requireOnchainFee = truthy(process.env.JARVIS_REQUIRE_ONCHAIN_FEE);
const swapPackageId = process.env.JARVIS_SWAP_PACKAGE_ID?.trim();
const swapConfigId = process.env.JARVIS_SWAP_CONFIG_OBJECT_ID?.trim();
requireWhenProduction(requireOnchainFee && (!swapPackageId || !swapConfigId), "JARVIS_SWAP_PACKAGE_ID and JARVIS_SWAP_CONFIG_OBJECT_ID are required when JARVIS_REQUIRE_ONCHAIN_FEE=true.");
for (const [name, value] of [["JARVIS_SWAP_PACKAGE_ID", swapPackageId], ["JARVIS_SWAP_CONFIG_OBJECT_ID", swapConfigId]]) {
  if (value && (!addressPattern.test(value) || /^0x0+$/.test(value))) throw new Error(`${name} must be a non-zero Sui object/package ID.`);
}

const sessionSecret = process.env.JARVIS_SESSION_SECRET?.trim();
const requireWalletSession = truthy(process.env.JARVIS_REQUIRE_WALLET_SESSION);
requireWhenProduction(requireWalletSession && !sessionSecret, "JARVIS_SESSION_SECRET is required when JARVIS_REQUIRE_WALLET_SESSION=true.");
if (sessionSecret && sessionSecret.length < 32) throw new Error("JARVIS_SESSION_SECRET must be at least 32 characters; use a high-entropy production secret.");
const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
requireWhenProduction(requireWalletSession && !appUrl, "NEXT_PUBLIC_APP_URL is required when wallet sessions are required.");
if (appUrl) {
  try {
    const parsed = new URL(appUrl);
    const local = parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1";
    if (parsed.protocol !== "https:" && !local) throw new Error();
  } catch { throw new Error("NEXT_PUBLIC_APP_URL must be an HTTPS application origin (localhost HTTP is allowed for development)."); }
}

const persistenceEnabled = truthy(process.env.DATABASE_PERSISTENCE_ENABLED);
const databaseUrl = process.env.DATABASE_URL?.trim();
requireWhenProduction(persistenceEnabled && !databaseUrl, "DATABASE_URL is required when DATABASE_PERSISTENCE_ENABLED=true.");
if (databaseUrl) {
  try {
    const parsed = new URL(databaseUrl);
    if (!["postgres:", "postgresql:"].includes(parsed.protocol)) throw new Error();
  } catch { throw new Error("DATABASE_URL must be a PostgreSQL connection URL."); }
}
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const supabasePublishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();
if ((supabaseUrl && !supabasePublishableKey) || (!supabaseUrl && supabasePublishableKey)) throw new Error("NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY must be configured together.");
if (supabaseUrl) {
  try { const parsed = new URL(supabaseUrl); if (parsed.protocol !== "https:") throw new Error(); }
  catch { throw new Error("NEXT_PUBLIC_SUPABASE_URL must be HTTPS."); }
}

const dedicatedRequired = truthy(process.env.JARVIS_REQUIRE_DEDICATED_RPC);
const effectiveGrpcUrls = grpcUrls.length ? grpcUrls : [process.env.SUI_GRPC_URL?.trim()].filter(Boolean);
const publicMainnetGrpc = effectiveGrpcUrls.filter((url) => /(^|\.)fullnode\.mainnet\.sui\.io$/i.test(new URL(url).hostname));
requireWhenProduction(dedicatedRequired && network === "mainnet" && publicMainnetGrpc.length > 0, "Production mainnet dedicated-RPC policy forbids Sui public-good Mainnet endpoints anywhere in SUI_GRPC_URLS.");
if (strictProduction && network === "mainnet") {
  if (!dedicatedRequired) throw new Error("Mainnet production requires JARVIS_REQUIRE_DEDICATED_RPC=true.");
  if (!truthy(process.env.JARVIS_REQUIRE_SIGNED_QUOTES)) throw new Error("Mainnet production requires JARVIS_REQUIRE_SIGNED_QUOTES=true.");
  if (!truthy(process.env.JARVIS_REQUIRE_WALLET_SESSION)) throw new Error("Mainnet production requires JARVIS_REQUIRE_WALLET_SESSION=true.");
  if (feeBps > 0 && !truthy(process.env.JARVIS_REQUIRE_ONCHAIN_FEE)) throw new Error("Mainnet production with a service fee requires JARVIS_REQUIRE_ONCHAIN_FEE=true.");
  if (!process.env.JARVIS_SUI_COIN_TYPE?.trim()) throw new Error("Mainnet production requires JARVIS_SUI_COIN_TYPE.");
  if (appUrl) {
    const parsed = new URL(appUrl);
    if (parsed.protocol !== "https:" || ["localhost", "127.0.0.1"].includes(parsed.hostname)) throw new Error("Mainnet production NEXT_PUBLIC_APP_URL must be a public HTTPS origin.");
  }
}

for (const warning of warnings) console.warn(`Environment warning: ${warning}`);
console.log(`Environment validation passed (${strictProduction ? "production" : "structural"}) for ${network}/${cluster}; fee=${feeBps} bps; grpcEndpoints=${grpcUrls.length || 1}; signedQuotes=${Boolean(quoteSecret)}; walletSession=${requireWalletSession}; onchainFeeRequired=${requireOnchainFee}; readinessRequireSwap=${readinessRequireSwap}; swapOperationsEnabled=${swapOperationsEnabled}; persistence=${persistenceEnabled}; warnings=${warnings.length}.`);
