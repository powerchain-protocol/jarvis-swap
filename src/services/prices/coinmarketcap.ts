import "server-only";
import { getServerConfig } from "@/config/env";
import type { PricePoint } from "./types";

type UnknownRecord = Record<string, unknown>;

function record(value: unknown): UnknownRecord | null {
  return value !== null && typeof value === "object" ? value as UnknownRecord : null;
}

function firstRecord(data: unknown): UnknownRecord | null {
  if (Array.isArray(data)) return record(data[0]);
  const row = record(data);
  if (!row) return null;
  const first = Object.values(row)[0];
  if (Array.isArray(first)) return record(first[0]);
  return record(first);
}

export async function fetchCoinMarketCapPrice(symbol: string, id?: string): Promise<PricePoint> {
  const config = getServerConfig();
  const authenticated = Boolean(config.coinMarketCapApiKey);
  const path = authenticated ? "/v3/cryptocurrency/quotes/latest" : "/public-api/v3/cryptocurrency/quotes/latest";
  const url = new URL(path, config.coinMarketCapBaseUrl);
  if (id) url.searchParams.set("id", id); else url.searchParams.set("symbol", symbol);
  url.searchParams.set("convert", "USD");
  const headers: Record<string, string> = { accept: "application/json" };
  if (config.coinMarketCapApiKey) headers["X-CMC_PRO_API_KEY"] = config.coinMarketCapApiKey;

  const response = await fetch(url, { headers, cache: "no-store", signal: AbortSignal.timeout(config.priceTimeoutMs) });
  if (!response.ok) throw new Error(`CoinMarketCap HTTP ${response.status}`);
  const payload = await response.json() as unknown;

  const root = record(payload);
  const asset = firstRecord(root?.data);
  const quoteRoot = record(asset?.quote);
  const quote = record(quoteRoot?.USD);
  const price = quote?.price;
  if (typeof price !== "number" || !Number.isFinite(price) || price <= 0) throw new Error("CoinMarketCap returned no valid USD quote.");

  const change = quote?.percent_change_24h;
  const updatedRaw = quote?.last_updated ?? asset?.last_updated;
  const updatedAt = typeof updatedRaw === "string" ? Date.parse(updatedRaw) : Date.now();
  return {
    symbol,
    priceUsd: price,
    change24h: typeof change === "number" && Number.isFinite(change) ? change : undefined,
    provider: "coinmarketcap",
    updatedAt: Number.isFinite(updatedAt) ? updatedAt : Date.now(),
  };
}
