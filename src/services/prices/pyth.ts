import "server-only";
import { getServerConfig } from "@/config/env";
import type { PricePoint } from "./types";
import { parsePythPayload } from "./validation";

export async function fetchPythPrice(symbol: string, feedId: string): Promise<PricePoint> {
  const config = getServerConfig();
  const id = feedId.startsWith("0x") ? feedId : `0x${feedId}`;
  let lastError: unknown;
  for (const base of config.pythUrls) {
    try {
      const url = new URL("/v2/updates/price/latest", base);
      url.searchParams.append("ids[]", id);
      url.searchParams.set("parsed", "true");
      const headers: Record<string, string> = { accept: "application/json" };
      if (config.pythApiKey) headers.authorization = `Bearer ${config.pythApiKey}`;
      const response = await fetch(url, { headers, cache: "no-store", signal: AbortSignal.timeout(config.priceTimeoutMs) });
      if (!response.ok) throw new Error(`Pyth HTTP ${response.status}`);
      const parsed = parsePythPayload(await response.json());
      if (!parsed) throw new Error("Pyth returned an invalid or unavailable price.");
      return { symbol, priceUsd: parsed.priceUsd, confidence: parsed.confidence, provider: "pyth", updatedAt: parsed.publishTime * 1000 };
    } catch (cause) { lastError = cause; }
  }
  throw lastError instanceof Error ? lastError : new Error("Pyth price unavailable.");
}
