import "server-only";
import { getServerConfig } from "@/config/env";
import { fetchBestPrice } from "@/services/prices";
import type { PriceAsset } from "@/services/prices/types";
import { AppError } from "@/utils/errors";

const SUPPORTED = new Set(["SUI", "USDC", "JARVIS", "CCT"]);

function asset(symbolInput: string): PriceAsset {
  const symbol = symbolInput.trim().toUpperCase();
  if (!SUPPORTED.has(symbol)) throw new AppError("BAD_REQUEST", `Unsupported rate asset: ${symbol || "unknown"}.`);
  const config = getServerConfig();
  return {
    symbol,
    coinType: config.tokenTypes[symbol as keyof typeof config.tokenTypes],
    pythFeedId: config.pythFeedIds[symbol],
    cmcId: config.coinMarketCapIds[symbol],
    coingeckoId: config.coinGeckoIds[symbol],
  };
}

export async function fetchMarketRate(baseInput: string, quoteInput: string) {
  const base = asset(baseInput);
  const quote = asset(quoteInput);
  if (base.symbol === quote.symbol) return { base: base.symbol, quote: quote.symbol, rate: 1, inverseRate: 1, updatedAt: Date.now(), sources: ["identity"] };
  const [basePrice, quotePrice] = await Promise.all([fetchBestPrice(base), fetchBestPrice(quote)]);
  if (!(basePrice.priceUsd > 0) || !(quotePrice.priceUsd > 0)) throw new AppError("UPSTREAM_ERROR", "Unable to derive a valid market conversion rate.");
  const rate = basePrice.priceUsd / quotePrice.priceUsd;
  return {
    base: base.symbol,
    quote: quote.symbol,
    rate,
    inverseRate: 1 / rate,
    baseUsd: basePrice.priceUsd,
    quoteUsd: quotePrice.priceUsd,
    updatedAt: Math.min(basePrice.updatedAt, quotePrice.updatedAt),
    sources: [...new Set([basePrice.provider, quotePrice.provider])],
  };
}
