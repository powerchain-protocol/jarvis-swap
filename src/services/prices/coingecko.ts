import "server-only";
import { getServerConfig } from "@/config/env";
import type { PricePoint } from "./types";
import { parseCoinGeckoPayload } from "./validation";

export async function fetchCoinGeckoPrice(symbol: string, coinId: string): Promise<PricePoint> {
  const config = getServerConfig();
  const url = new URL("/api/v3/simple/price", config.coinGeckoBaseUrl);
  url.searchParams.set("ids", coinId);
  url.searchParams.set("vs_currencies", "usd");
  url.searchParams.set("include_24hr_change", "true");
  url.searchParams.set("include_last_updated_at", "true");
  const headers: Record<string, string> = { accept: "application/json" };
  if (config.coinGeckoApiKey) headers[config.coinGeckoKeyHeader] = config.coinGeckoApiKey;
  const response = await fetch(url, { headers, cache: "no-store", signal: AbortSignal.timeout(config.priceTimeoutMs) });
  if (!response.ok) throw new Error(`CoinGecko HTTP ${response.status}`);
  const quote = parseCoinGeckoPayload(await response.json(), coinId);
  if (!quote) throw new Error("CoinGecko returned an invalid or unavailable USD quote.");
  return { symbol, priceUsd: quote.usd, change24h: quote.change24h, provider: "coingecko", updatedAt: (quote.lastUpdatedAt ?? Math.floor(Date.now() / 1000)) * 1000 };
}
