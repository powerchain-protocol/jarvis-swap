"use client";
import type { Token } from "@/services/quotes/types";
import type { PricePoint, PriceProvider } from "./types";
import { cached, withAbortSignal } from "@/utils/cache";
import { apiErrorMessage, readApiJson } from "@/utils/api-client";
import { API_ROUTES } from "@/constants/routes";
import { assertCoinType } from "@/services/sui/address";

const PRICE_CACHE_MS = 20_000;
const PROVIDERS = new Set<PriceProvider>(["pyth", "birdeye", "coinmarketcap", "coingecko"]);
type PriceResponse = { prices?: unknown; errors?: Array<{ symbol: string; error: string }> };

function pricePoint(value: unknown): PricePoint | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const item = value as Record<string, unknown>;
  if (typeof item.symbol !== "string" || typeof item.provider !== "string" || !PROVIDERS.has(item.provider as PriceProvider)) return null;
  if (typeof item.priceUsd !== "number" || !Number.isFinite(item.priceUsd) || item.priceUsd <= 0) return null;
  if (typeof item.updatedAt !== "number" || !Number.isFinite(item.updatedAt) || item.updatedAt <= 0) return null;
  let coinType: string | undefined;
  if (typeof item.coinType === "string") {
    try { coinType = assertCoinType(item.coinType, "price coin type"); } catch { return null; }
  }
  return {
    symbol: item.symbol.slice(0, 32), ...(coinType ? { coinType } : {}), priceUsd: item.priceUsd, provider: item.provider as PriceProvider, updatedAt: item.updatedAt,
    confidence: typeof item.confidence === "number" && Number.isFinite(item.confidence) ? item.confidence : undefined,
    liquidityUsd: typeof item.liquidityUsd === "number" && Number.isFinite(item.liquidityUsd) ? item.liquidityUsd : undefined,
    change24h: typeof item.change24h === "number" && Number.isFinite(item.change24h) ? item.change24h : undefined,
  };
}

export async function fetchMarketPrices(symbols: string[], signal?: AbortSignal) {
  const normalized = [...new Set(symbols.map((s) => s.toUpperCase()))].sort();
  const query = new URLSearchParams({ symbols: normalized.join(",") });
  const key = `prices:${normalized.join(",")}`;
  const shared = cached(key, PRICE_CACHE_MS, async () => {
    // The shared price request is independent from any one component's lifecycle.
    // Callers can cancel their own wait without aborting the deduplicated upstream fetch.
    const response = await fetch(`${API_ROUTES.prices}?${query}`, { cache: "no-store" });
    const payload = await readApiJson<PriceResponse & { error?: unknown }>(response);
    if (!payload) throw new Error(apiErrorMessage(payload, "Unable to fetch market prices."));
    const prices = Array.isArray(payload.prices) ? payload.prices.map(pricePoint).filter((point): point is PricePoint => Boolean(point)) : [];
    if (!response.ok && !prices.length) throw new Error(apiErrorMessage(payload, "Unable to fetch market prices."));
    return { prices, errors: Array.isArray(payload.errors) ? payload.errors : [] };
  });
  return withAbortSignal(shared, signal);
}

export function applyMarketPrices(tokens: Token[], prices: PricePoint[]): Token[] {
  const byCoinType = new Map<string, PricePoint>();
  const byTrustedSymbol = new Map<string, PricePoint>();
  for (const price of prices) {
    if (price.coinType) byCoinType.set(price.coinType, price);
    byTrustedSymbol.set(price.symbol.toUpperCase(), price);
  }

  return tokens.map((token) => {
    let canonicalCoinType: string | undefined;
    if (token.coinType) {
      try { canonicalCoinType = assertCoinType(token.coinType, "token coin type"); } catch { /* invalid custom token stays unpriced */ }
    }
    // Price identity is coin-type first. Symbol fallback is allowed only for tokens
    // already verified by the trusted registry, preventing a user-imported token
    // named SUI/USDC/JARVIS from inheriting another asset's market price.
    const point = canonicalCoinType
      ? byCoinType.get(canonicalCoinType)
      : token.verified
        ? byTrustedSymbol.get(token.symbol.toUpperCase())
        : undefined;
    return point ? { ...token, priceUsd: point.priceUsd } : token;
  });
}
