import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { getServerConfig } from "@/config/env";
import type { RoutingPreference } from "@/config/settings";
import { MAX_SERVICE_FEE_BPS } from "@/constants/fees";
import { assertCoinType, normalizeSuiAddress } from "@/services/sui/address";
import { AppError } from "@/utils/errors";
import { decodeBase64Strict } from "@/utils/encoding";
import { getExecutionPolicyFingerprint } from "@/services/system/policy-fingerprint";

export type SignedQuoteClaims = {
  id: string;
  network: "mainnet" | "testnet" | "devnet";
  issuedAt: number;
  expiresAt: number;
  payCoinType: string;
  receiveCoinType: string;
  payDecimals: number;
  receiveDecimals: number;
  grossAmountInBaseUnits: string;
  netSwapAmountBaseUnits: string;
  amountOutBaseUnits: string;
  minimumAmountOutBaseUnits: string;
  routeCommitment: string;
  policyFingerprint: string;
  serviceFeeBaseUnits: string;
  serviceFeeBps: number;
  serviceFeeRecipient?: string;
  slippageBps: number;
  maxPriceImpactBps: number;
  priceImpactBps: number;
  routing: RoutingPreference;
  deadlineMinutes: number;
};

const ROUTING = new Set<RoutingPreference>(["best-price", "lowest-impact", "custom"]);

function integer(value: unknown, name: string, min: number, max: number) {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < min || value > max) {
    throw new AppError("BAD_REQUEST", `Invalid ${name}.`);
  }
  return value;
}

function baseUnits(value: unknown, name: string, allowZero = false) {
  if (typeof value !== "string" || !/^\d{1,80}$/.test(value)) throw new AppError("BAD_REQUEST", `Invalid ${name}.`);
  const parsed = BigInt(value);
  if (allowZero ? parsed < 0n : parsed <= 0n) throw new AppError("BAD_REQUEST", `${name} must be ${allowZero ? "non-negative" : "positive"}.`);
  return value;
}

/** Runtime-normalize quote claims before verification. TypeScript types alone do
 * not validate JSON received from a browser or another HTTP client. */
export function parseSignedQuoteClaims(input: unknown): SignedQuoteClaims {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new AppError("BAD_REQUEST", "Quote claims are required.");
  const value = input as Record<string, unknown>;
  const id = typeof value.id === "string" ? value.id.trim() : "";
  if (!id || id.length > 256) throw new AppError("BAD_REQUEST", "Invalid quote identifier.");

  const network = value.network === "mainnet" || value.network === "testnet" || value.network === "devnet" ? value.network : undefined;
  if (!network) throw new AppError("BAD_REQUEST", "Invalid quote network.");

  const issuedAt = integer(value.issuedAt, "quote issue timestamp", 1, Number.MAX_SAFE_INTEGER);
  const expiresAt = integer(value.expiresAt, "quote expiry timestamp", issuedAt + 1, Number.MAX_SAFE_INTEGER);
  if (expiresAt - issuedAt > 120_000) throw new AppError("BAD_REQUEST", "Quote validity window is too large.");

  const payCoinType = assertCoinType(String(value.payCoinType ?? ""), "pay coin type");
  const receiveCoinType = assertCoinType(String(value.receiveCoinType ?? ""), "receive coin type");
  if (payCoinType === receiveCoinType) throw new AppError("BAD_REQUEST", "Pay and receive tokens must be different.");
  const payDecimals = integer(value.payDecimals, "pay token decimals", 0, 18);
  const receiveDecimals = integer(value.receiveDecimals, "receive token decimals", 0, 18);

  const serviceFeeBps = integer(value.serviceFeeBps, "service fee", 0, MAX_SERVICE_FEE_BPS);
  const slippageBps = integer(value.slippageBps, "slippage", 1, 5_000);
  const maxPriceImpactBps = integer(value.maxPriceImpactBps, "maximum price impact", 10, 5_000);
  const priceImpactBps = integer(value.priceImpactBps, "price impact", 0, 100_000);
  const deadlineMinutes = integer(value.deadlineMinutes, "transaction deadline", 1, 60);
  if (priceImpactBps > maxPriceImpactBps) throw new AppError("BAD_REQUEST", "Quote price impact exceeds its signed protection limit.");

  const routing = typeof value.routing === "string" && ROUTING.has(value.routing as RoutingPreference)
    ? value.routing as RoutingPreference
    : undefined;
  if (!routing) throw new AppError("BAD_REQUEST", "Invalid quote routing preference.");

  const grossAmountInBaseUnits = baseUnits(value.grossAmountInBaseUnits, "gross input");
  const netSwapAmountBaseUnits = baseUnits(value.netSwapAmountBaseUnits, "net swap input");
  const amountOutBaseUnits = baseUnits(value.amountOutBaseUnits, "quoted output");
  const minimumAmountOutBaseUnits = baseUnits(value.minimumAmountOutBaseUnits, "minimum output");
  if (BigInt(minimumAmountOutBaseUnits) > BigInt(amountOutBaseUnits)) throw new AppError("BAD_REQUEST", "Minimum output exceeds quoted output.");
  const routeCommitment = typeof value.routeCommitment === "string" && /^[a-f0-9]{64}$/.test(value.routeCommitment) ? value.routeCommitment : "";
  if (!routeCommitment) throw new AppError("BAD_REQUEST", "Invalid route commitment.");
  const policyFingerprint = typeof value.policyFingerprint === "string" && /^[a-f0-9]{64}$/.test(value.policyFingerprint) ? value.policyFingerprint : "";
  if (!policyFingerprint) throw new AppError("BAD_REQUEST", "Invalid execution policy fingerprint.");
  const serviceFeeBaseUnits = baseUnits(value.serviceFeeBaseUnits, "service fee amount", true);
  const gross = BigInt(grossAmountInBaseUnits);
  const net = BigInt(netSwapAmountBaseUnits);
  const fee = BigInt(serviceFeeBaseUnits);
  if (net + fee !== gross) throw new AppError("BAD_REQUEST", "Quote gross, net, and service-fee amounts are inconsistent.");
  if ((gross * BigInt(serviceFeeBps)) / 10_000n !== fee) throw new AppError("BAD_REQUEST", "Quote service-fee amount does not match its signed fee policy.");

  const serviceFeeRecipient = value.serviceFeeRecipient == null || value.serviceFeeRecipient === ""
    ? undefined
    : normalizeSuiAddress(String(value.serviceFeeRecipient));
  if (serviceFeeBps > 0 && !serviceFeeRecipient) throw new AppError("BAD_REQUEST", "Signed service fee requires a recipient.");

  return {
    id,
    network,
    issuedAt,
    expiresAt,
    payCoinType,
    receiveCoinType,
    payDecimals,
    receiveDecimals,
    grossAmountInBaseUnits,
    netSwapAmountBaseUnits,
    amountOutBaseUnits,
    minimumAmountOutBaseUnits,
    routeCommitment,
    policyFingerprint,
    serviceFeeBaseUnits,
    serviceFeeBps,
    serviceFeeRecipient,
    slippageBps,
    maxPriceImpactBps,
    priceImpactBps,
    routing,
    deadlineMinutes,
  };
}

function canonicalize(claims: SignedQuoteClaims) {
  return [
    claims.id,
    claims.network,
    claims.issuedAt,
    claims.expiresAt,
    claims.payCoinType,
    claims.receiveCoinType,
    claims.payDecimals,
    claims.receiveDecimals,
    claims.grossAmountInBaseUnits,
    claims.netSwapAmountBaseUnits,
    claims.amountOutBaseUnits,
    claims.minimumAmountOutBaseUnits,
    claims.routeCommitment,
    claims.policyFingerprint,
    claims.serviceFeeBaseUnits,
    claims.serviceFeeBps,
    claims.serviceFeeRecipient ?? "",
    claims.slippageBps,
    claims.maxPriceImpactBps,
    claims.priceImpactBps,
    claims.routing,
    claims.deadlineMinutes,
  ].join("|");
}

export function signQuoteClaims(claims: SignedQuoteClaims) {
  const normalized = parseSignedQuoteClaims(claims);
  const secret = getServerConfig().quoteSigningSecret;
  if (!secret) return undefined;
  return createHmac("sha256", secret).update(canonicalize(normalized)).digest("base64url");
}

export function verifyQuoteClaims(input: unknown, signature?: string) {
  const claims = parseSignedQuoteClaims(input);
  const config = getServerConfig();
  if (claims.network !== config.network) throw new AppError("BAD_REQUEST", "Quote network does not match this deployment.");
  if (claims.policyFingerprint !== getExecutionPolicyFingerprint()) {
    throw new AppError("CONFLICT", "Execution policy changed. Refresh the quote before signing or submitting.", { status: 409 });
  }
  if (!config.quoteSigningSecret) {
    if (config.requireSignedQuotes) throw new AppError("CONFIGURATION_ERROR", "JARVIS_QUOTE_SIGNING_SECRET is required by deployment policy.");
    const now = Date.now();
    if (now >= claims.expiresAt) throw new AppError("BAD_REQUEST", "Quote has expired.");
    if (claims.expiresAt - now < config.minQuoteValidityMs) throw new AppError("BAD_REQUEST", "Quote is too close to expiry. Refresh before signing.");
    return { signed: false as const, claims };
  }
  if (!signature) throw new AppError("BAD_REQUEST", "Signed quote is required.");
  const expected = createHmac("sha256", config.quoteSigningSecret).update(canonicalize(claims)).digest();
  const supplied = Buffer.from(decodeBase64Strict(signature, { minBytes: expected.length, maxBytes: expected.length, label: "quote signature" }));
  if (!timingSafeEqual(supplied, expected)) throw new AppError("BAD_REQUEST", "Quote signature is invalid.");
  const now = Date.now();
  if (now >= claims.expiresAt) throw new AppError("BAD_REQUEST", "Quote has expired.");
  if (claims.expiresAt - now < config.minQuoteValidityMs) throw new AppError("BAD_REQUEST", "Quote is too close to expiry. Refresh before signing.");
  return { signed: true as const, claims };
}
