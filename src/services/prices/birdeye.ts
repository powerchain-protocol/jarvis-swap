import "server-only";
import { getServerConfig } from "@/config/env";
import type { PricePoint } from "./types";
import { parseBirdeyePayload } from "./validation";

export async function fetchBirdeyePrice(symbol: string, coinType: string): Promise<PricePoint> {
  const config = getServerConfig();
  if (!config.birdeyeApiKey) throw new Error("BIRDEYE_API_KEY is not configured.");
  const url = new URL("/defi/price", config.birdeyeBaseUrl);
  url.searchParams.set("address", coinType);
  url.searchParams.set("include_liquidity", "true");
  const response = await fetch(url, {
    headers: { accept: "application/json", "X-API-KEY": config.birdeyeApiKey, "x-chain": "sui" },
    cache: "no-store",
    signal: AbortSignal.timeout(config.priceTimeoutMs),
  });
  if (!response.ok) throw new Error(`Birdeye HTTP ${response.status}`);
  const payload = parseBirdeyePayload(await response.json());
  if (!payload) throw new Error("Birdeye returned an invalid or unavailable Sui price.");
  return { symbol, priceUsd: payload.value, liquidityUsd: payload.liquidity, provider: "birdeye", updatedAt: (payload.updateUnixTime ?? Math.floor(Date.now() / 1000)) * 1000 };
}
