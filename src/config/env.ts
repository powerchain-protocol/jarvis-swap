import "server-only";
import { assertCoinType, normalizeSuiAddress } from "@/services/sui/address";
import type { PriceProvider } from "@/services/prices/types";
import { DEFAULT_SERVICE_FEE_BPS, MAX_SERVICE_FEE_BPS } from "@/constants/fees";
import { AppError } from "@/utils/errors";

import type { SuiCluster } from "@/types/clusters";

export type SuiNetwork = "mainnet" | "testnet" | "devnet";

function network(): SuiNetwork {
  const value = (process.env.NEXT_PUBLIC_SUI_NETWORK ?? "mainnet").toLowerCase();
  if (value !== "mainnet" && value !== "testnet" && value !== "devnet") throw new Error("NEXT_PUBLIC_SUI_NETWORK must be mainnet, testnet, or devnet.");
  return value;
}

function cluster(selectedNetwork: SuiNetwork): SuiCluster {
  const value = (process.env.NEXT_PUBLIC_SUI_CLUSTER ?? selectedNetwork).trim().toLowerCase();
  if (value !== "mainnet" && value !== "testnet" && value !== "devnet" && value !== "custom") {
    throw new Error("NEXT_PUBLIC_SUI_CLUSTER must be mainnet, testnet, devnet, or custom.");
  }
  if (value !== "custom" && value !== selectedNetwork) {
    throw new Error(`NEXT_PUBLIC_SUI_CLUSTER=${value} does not match NEXT_PUBLIC_SUI_NETWORK=${selectedNetwork}. Use custom for a custom endpoint.`);
  }
  return value;
}

function validateGrpcUrl(raw: string, name: string, requireHttps: boolean) {
  let url: URL;
  try { url = new URL(raw); } catch { throw new Error(`${name} must be a valid URL.`); }
  if (url.username || url.password) throw new Error(`${name} must not contain URL-embedded credentials.`);
  if (requireHttps && url.protocol !== "https:") throw new Error(`${name} must use HTTPS on mainnet.`);
  if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error(`${name} must use HTTP(S).`);
  return url.toString().replace(/\/$/, "");
}

function integer(name: string, fallback: number, min: number, max: number) {
  const raw = process.env[name];
  const value = raw == null || raw === "" ? fallback : Number(raw);
  if (!Number.isInteger(value) || value < min || value > max) throw new Error(`${name} must be an integer between ${min} and ${max}.`);
  return value;
}

function optionalCoinType(name: string) {
  const value = process.env[name]?.trim();
  return value ? assertCoinType(value, name) : undefined;
}

function bool(name: string, fallback = false) {
  const raw = process.env[name]?.trim().toLowerCase();
  if (!raw) return fallback;
  if (raw === "true" || raw === "1" || raw === "yes") return true;
  if (raw === "false" || raw === "0" || raw === "no") return false;
  throw new Error(`${name} must be true or false.`);
}

function csv(name: string, fallback = ""): string[] {
  return (process.env[name] ?? fallback).split(",").map((value: string) => value.trim()).filter(Boolean);
}

function unique(values: readonly string[]) {
  return [...new Set(values)];
}

function publicLabel(name: string, fallback: string) {
  const value = process.env[name]?.trim() || fallback;
  if (value.length > 64 || /[\u0000-\u001f\u007f]/.test(value)) throw new Error(`${name} must be a printable label of at most 64 characters.`);
  return value;
}

function mapEnv(name: string) {
  const result: Record<string, string> = {};
  for (const item of csv(name)) {
    const index = item.indexOf(":");
    if (index <= 0) continue;
    result[item.slice(0, index).trim().toUpperCase()] = item.slice(index + 1).trim();
  }
  return result;
}

export function getServerConfig() {
  const selectedNetwork = network();
  const selectedCluster = cluster(selectedNetwork);
  const feeBps = integer("JARVIS_SWAP_SERVICE_FEE_BPS", DEFAULT_SERVICE_FEE_BPS, 0, MAX_SERVICE_FEE_BPS);
  const feeWalletRaw = process.env.JARVIS_SWAP_FEE_WALLET?.trim();
  const feeWallet = feeWalletRaw ? normalizeSuiAddress(feeWalletRaw) : undefined;
  const defaultRpc = selectedNetwork === "testnet" ? "https://fullnode.testnet.sui.io:443" : selectedNetwork === "devnet" ? "https://fullnode.devnet.sui.io:443" : "https://fullnode.mainnet.sui.io:443";
  const customGrpc = process.env.SUI_CUSTOM_GRPC_URL?.trim();
  const configuredGrpcUrls = csv("SUI_GRPC_URLS", selectedCluster === "custom" ? (customGrpc || process.env.SUI_GRPC_URL?.trim() || "") : (process.env.SUI_GRPC_URL?.trim() || defaultRpc));
  if (selectedCluster === "custom" && configuredGrpcUrls.length === 0) throw new Error("Custom Sui cluster requires SUI_CUSTOM_GRPC_URL or SUI_GRPC_URLS.");
  const grpcUrls = unique((configuredGrpcUrls.length ? configuredGrpcUrls : [defaultRpc]).map((value, index) => validateGrpcUrl(value, `SUI_GRPC_URLS[${index}]`, selectedNetwork === "mainnet")));
  const protectedRpcRaw = process.env.SUI_PROTECTED_RPC_URL?.trim();
  const protectedRpcUrl = protectedRpcRaw ? validateGrpcUrl(protectedRpcRaw, "SUI_PROTECTED_RPC_URL", selectedNetwork === "mainnet") : undefined;
  const providers = csv("PRICE_PROVIDER_ORDER", "pyth,birdeye,coinmarketcap,coingecko").filter((v): v is PriceProvider => ["pyth", "birdeye", "coinmarketcap", "coingecko"].includes(v));
  const deepBookPoolIds = csv("DEEPBOOK_POOL_IDS").map((value) => normalizeSuiAddress(value));
  const additionalTrustedCoinTypes = Object.fromEntries(Object.entries(mapEnv("TRUSTED_TOKEN_COIN_TYPES")).map(([symbol, coinType]) => [symbol, assertCoinType(coinType, `TRUSTED_TOKEN_COIN_TYPES:${symbol}`)]));
  const cetusPoolIds = csv("CETUS_POOL_IDS").map((value) => normalizeSuiAddress(value));

  return {
    network: selectedNetwork,
    cluster: selectedCluster,
    clusterLabel: selectedCluster === "custom" ? publicLabel("NEXT_PUBLIC_SUI_CUSTOM_RPC_LABEL", `Custom ${selectedNetwork}`) : `Sui ${selectedNetwork}`,
    rpcUrls: unique(csv("SUI_RPC_URLS", process.env.SUI_RPC_URL?.trim() || defaultRpc).map((value, index) => validateGrpcUrl(value, `SUI_RPC_URLS[${index}]`, selectedNetwork === "mainnet"))),
    rpcTimeoutMs: integer("SUI_RPC_TIMEOUT_MS", 8_000, 1_000, 30_000),
    rpcRetries: integer("SUI_RPC_RETRIES", 2, 0, 5),
    rpcFailureThreshold: integer("SUI_RPC_FAILURE_THRESHOLD", 3, 1, 10),
    rpcCooldownMs: integer("SUI_RPC_COOLDOWN_MS", 15_000, 1_000, 300_000),
    grpcUrls,
    grpcUrl: grpcUrls[0],
    protectedRpcUrl,
    cetusEndpoint: process.env.CETUS_AGGREGATOR_URL?.trim() || "https://api-sui.cetus.zone/router_v3/find_routes",
    cetusApiKey: process.env.CETUS_AGGREGATOR_API_KEY?.trim() || undefined,
    cetusQuoteTimeoutMs: integer("CETUS_QUOTE_TIMEOUT_MS", 8_000, 1_000, 30_000),
    pythUrls: csv("PYTH_HERMES_URLS", selectedNetwork === "mainnet" ? "https://hermes.pyth.network" : "https://hermes-beta.pyth.network"),
    pythApiKey: process.env.PYTH_API_KEY?.trim() || undefined,
    pythFeedIds: mapEnv("PYTH_FEED_IDS"),
    birdeyeApiKey: process.env.BIRDEYE_API_KEY?.trim() || undefined,
    birdeyeBaseUrl: process.env.BIRDEYE_BASE_URL?.trim() || "https://public-api.birdeye.so",
    coinMarketCapApiKey: process.env.COINMARKETCAP_API_KEY?.trim() || undefined,
    coinMarketCapBaseUrl: process.env.COINMARKETCAP_BASE_URL?.trim() || "https://pro-api.coinmarketcap.com",
    coinMarketCapIds: mapEnv("COINMARKETCAP_IDS"),
    coinGeckoApiKey: process.env.COINGECKO_API_KEY?.trim() || undefined,
    coinGeckoBaseUrl: process.env.COINGECKO_BASE_URL?.trim() || (process.env.COINGECKO_API_KEY ? "https://pro-api.coingecko.com" : "https://api.coingecko.com"),
    coinGeckoKeyHeader: process.env.COINGECKO_KEY_HEADER?.trim() || (process.env.COINGECKO_API_KEY ? "x-cg-pro-api-key" : "x-cg-demo-api-key"),
    coinGeckoIds: mapEnv("COINGECKO_IDS"),
    priceProviderOrder: providers.length ? providers : (["pyth", "birdeye", "coinmarketcap", "coingecko"] as PriceProvider[]),
    priceTimeoutMs: integer("PRICE_FETCH_TIMEOUT_MS", 5_000, 1_000, 20_000),
    priceMaxStalenessMs: integer("PRICE_MAX_STALENESS_MS", 60_000, 1_000, 600_000),
    pythMaxConfidenceBps: integer("PYTH_MAX_CONFIDENCE_BPS", 500, 1, 5000),
    feeBps,
    feeWallet,
    quoteTtlMs: integer("JARVIS_QUOTE_TTL_MS", 30_000, 5_000, 120_000),
    sessionTtlMs: integer("JARVIS_SESSION_TTL_MS", 43_200_000, 300_000, 604_800_000),
    sessionChallengeTtlMs: integer("JARVIS_SESSION_CHALLENGE_TTL_MS", 120_000, 30_000, 600_000),
    requireWalletSession: bool("JARVIS_REQUIRE_WALLET_SESSION", selectedNetwork === "mainnet"),
    minQuoteValidityMs: integer("JARVIS_MIN_QUOTE_VALIDITY_MS", 5_000, 1_000, 30_000),
    quoteSigningSecret: process.env.JARVIS_QUOTE_SIGNING_SECRET?.trim() || undefined,
    requireSignedQuotes: bool("JARVIS_REQUIRE_SIGNED_QUOTES", false),
    requireOnchainFee: bool("JARVIS_REQUIRE_ONCHAIN_FEE", false),
    transactionWaitTimeoutMs: integer("SUI_TRANSACTION_WAIT_TIMEOUT_MS", 60_000, 5_000, 120_000),
    maxGasBudgetMist: integer("JARVIS_MAX_GAS_BUDGET_MIST", 2_000_000_000, 10_000_000, 20_000_000_000),
    gasReserveMist: integer("SUI_GAS_RESERVE_MIST", 20_000_000, 1_000_000, 5_000_000_000),
    allowedCetusProviders: csv("CETUS_ALLOWED_PROVIDERS"),
    deepBookEnabled: bool("DEEPBOOK_ENABLED", false),
    deepBookPoolIds,
    maxPriceImpactBps: integer("JARVIS_MAX_PRICE_IMPACT_BPS", 300, 10, 5000),
    maxSlippageBps: integer("JARVIS_MAX_SLIPPAGE_BPS", 1000, 1, 5000),
    swapPackageId: process.env.JARVIS_SWAP_PACKAGE_ID?.trim() || undefined,
    swapConfigObjectId: process.env.JARVIS_SWAP_CONFIG_OBJECT_ID?.trim() || undefined,
    additionalTrustedCoinTypes,
    tokenTypes: {
      SUI: "0x2::sui::SUI",
      // The canonical mainnet USDC type must never leak into Testnet/Devnet.
      // Non-mainnet deployments must configure SUI_USDC_COIN_TYPE explicitly.
      USDC: optionalCoinType("SUI_USDC_COIN_TYPE") ?? (selectedNetwork === "mainnet"
        ? "0xdba34672e30cb065b1f93e3ab55318768fd6fef66c15942c9f7cb846e2f900e7::usdc::USDC"
        : undefined),
      JARVIS: optionalCoinType("JARVIS_SUI_COIN_TYPE"),
      CCT: optionalCoinType("CCT_SUI_COIN_TYPE"),
    },
    cetusPoolIds,
    cetusPositionObjectType: process.env.CETUS_POSITION_OBJECT_TYPE?.trim() || undefined,
    cetusPositionLimit: integer("CETUS_POSITION_LIMIT", 100, 1, 500),
    cetusPoolCacheTtlMs: integer("CETUS_POOL_CACHE_TTL_MS", 15_000, 1_000, 300_000),
    walletActivityLimit: integer("JARVIS_WALLET_ACTIVITY_LIMIT", 25, 5, 100),
    activityMaxItems: integer("JARVIS_ACTIVITY_MAX_ITEMS", 50, 10, 250),
    portfolioCacheTtlMs: integer("PORTFOLIO_CACHE_TTL_MS", 15_000, 1_000, 300_000),
    apiRateLimitWindowMs: integer("API_RATE_LIMIT_WINDOW_MS", 60_000, 1_000, 3_600_000),
    quoteConcurrency: integer("API_QUOTE_CONCURRENCY", 12, 1, 100),
    portfolioConcurrency: integer("API_PORTFOLIO_CONCURRENCY", 8, 1, 100),
    priceConcurrency: integer("API_PRICE_CONCURRENCY", 16, 1, 200),
    requestQueueLimit: integer("API_REQUEST_QUEUE_LIMIT", 32, 0, 500),
    requestQueueWaitMs: integer("API_REQUEST_QUEUE_WAIT_MS", 2_000, 100, 30_000),
    upstreamFailureThreshold: integer("UPSTREAM_FAILURE_THRESHOLD", 4, 1, 20),
    upstreamCooldownMs: integer("UPSTREAM_COOLDOWN_MS", 15_000, 1_000, 300_000),
    idempotencyTtlMs: integer("API_IDEMPOTENCY_TTL_MS", 86_400_000, 60_000, 604_800_000),
    idempotencyLockTtlMs: integer("API_IDEMPOTENCY_LOCK_TTL_MS", 60_000, 5_000, 300_000),
    productionRpcRequired: bool("JARVIS_REQUIRE_DEDICATED_RPC", selectedNetwork === "mainnet"),
    readinessRequireSwap: bool("JARVIS_READINESS_REQUIRE_SWAP", selectedNetwork === "mainnet"),
    readinessTimeoutMs: integer("JARVIS_READINESS_TIMEOUT_MS", 5_000, 1_000, 30_000),
    maintenanceMode: bool("JARVIS_MAINTENANCE_MODE", false),
    swapOperationsEnabled: bool("JARVIS_SWAP_OPERATIONS_ENABLED", true),
  } as const;
}

export function assertFeeConfiguration() {
  const config = getServerConfig();
  if (config.feeBps > 0 && !config.feeWallet) {
    throw new AppError("CONFIGURATION_ERROR", "JARVIS_SWAP_FEE_WALLET is required when JARVIS_SWAP_SERVICE_FEE_BPS is greater than zero.");
  }
  return config;
}
