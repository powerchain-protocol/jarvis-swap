import "server-only";
import { getServerConfig } from "@/config/env";
import { fetchBirdeyePrice } from "@/lib/birdeye";
import { fetchCoinGeckoPrice } from "@/lib/coingecko";
import { fetchCoinMarketCapPrice } from "./coinmarketcap";
import { fetchPythPrice } from "@/lib/pyth";
import type { PriceAsset, PricePoint, PriceProvider } from "./types";
import { cached } from "@/utils/cache";
import { assertCoinType } from "@/services/sui/address";
import { withCircuitBreaker } from "@/services/upstream/circuit-breaker";

function validatePrice(point: PricePoint) {
  const config = getServerConfig();
  if (!Number.isFinite(point.priceUsd) || point.priceUsd <= 0) throw new Error("provider returned an invalid price");
  const age = Date.now() - point.updatedAt;
  if (!Number.isFinite(age) || age < -30_000 || age > config.priceMaxStalenessMs) throw new Error(`provider price is stale (${Math.max(0, Math.round(age / 1000))}s old)`);
  if (point.provider === "pyth" && point.confidence != null) {
    const confidenceBps = point.priceUsd > 0 ? Math.round((point.confidence / point.priceUsd) * 10_000) : Number.POSITIVE_INFINITY;
    if (confidenceBps > config.pythMaxConfidenceBps) throw new Error(`Pyth confidence interval is too wide (${confidenceBps} bps)`);
  }
  return point;
}

export async function fetchBestPrice(asset: PriceAsset): Promise<PricePoint> {
  const config = getServerConfig();
  const canonicalCoinType = asset.coinType ? assertCoinType(asset.coinType, "price asset coin type") : undefined;
  const cacheKey = [asset.symbol, canonicalCoinType, asset.pythFeedId, asset.cmcId, asset.coingeckoId]
    .map((value) => value ?? "")
    .join(":");
  const ttlMs = Math.max(5_000, Math.min(20_000, Math.floor(config.priceMaxStalenessMs / 3)));

  return cached(`price:${cacheKey}`, ttlMs, async () => {
    const errors: string[] = [];
    for (const provider of config.priceProviderOrder) {
      try {
        let point: PricePoint | undefined;
        const load = async () => {
          if (provider === "pyth" && asset.pythFeedId) return fetchPythPrice(asset.symbol, asset.pythFeedId);
          if (provider === "birdeye" && canonicalCoinType) return fetchBirdeyePrice(asset.symbol, canonicalCoinType);
          if (provider === "coinmarketcap") return fetchCoinMarketCapPrice(asset.symbol, asset.cmcId);
          if (provider === "coingecko" && asset.coingeckoId) return fetchCoinGeckoPrice(asset.symbol, asset.coingeckoId);
          return undefined;
        };
        point = await withCircuitBreaker(`price-${provider}`, load, {
          failureThreshold: config.upstreamFailureThreshold,
          cooldownMs: config.upstreamCooldownMs,
        });
        if (point) return { ...validatePrice(point), ...(canonicalCoinType ? { coinType: canonicalCoinType } : {}) };
      } catch (cause) {
        errors.push(`${provider}: ${cause instanceof Error ? cause.message : "failed"}`);
      }
    }
    throw new Error(`No acceptable price provider returned ${asset.symbol}. ${errors.join(" | ")}`);
  });
}

export function isPriceProvider(value: string): value is PriceProvider {
  return ["pyth", "birdeye", "coinmarketcap", "coingecko"].includes(value);
}
