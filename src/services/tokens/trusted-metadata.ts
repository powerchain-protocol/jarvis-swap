import "server-only";

import { getCoinMetadataGrpc } from "@/services/sui/grpc";
import { asRecord, asString } from "@/services/sui/object-shapes";
import { getTrustedTokenList, getTrustedTokenRegistryId } from "@/services/tokens/trusted";
import type { TrustedTokenMetadata } from "@/metadata/metadata";

export type HydratedTrustedToken = TrustedTokenMetadata & {
  metadataStatus: "resolved" | "fallback";
  metadataUpdatedAt: number;
};

type CacheEntry = { expiresAt: number; tokens: HydratedTrustedToken[] };
const cache = new Map<string, CacheEntry>();
const TTL_MS = 5 * 60_000;
const MAX_CONCURRENCY = 4;

function boundedText(value: unknown, fallback: string, max = 80) {
  if (typeof value !== "string") return fallback;
  const text = value.trim();
  return text ? text.slice(0, max) : fallback;
}

function parseDecimals(value: unknown, fallback: number) {
  const numeric = typeof value === "number" ? value : typeof value === "string" && /^\d+$/.test(value) ? Number(value) : NaN;
  return Number.isInteger(numeric) && numeric >= 0 && numeric <= 18 ? numeric : fallback;
}

async function hydrateToken(token: TrustedTokenMetadata): Promise<HydratedTrustedToken> {
  const now = Date.now();
  try {
    const raw = await getCoinMetadataGrpc(token.coinType);
    const metadata = asRecord(raw) ?? {};
    const symbol = boundedText(asString(metadata.symbol), token.symbol, 32).toUpperCase();
    const name = boundedText(asString(metadata.name), token.name, 96);
    const decimals = parseDecimals(metadata.decimals, token.decimals);
    const iconUrl = asString(metadata.iconUrl);
    return {
      ...token,
      // Trust still comes from exact registry coin type; chain metadata only enriches display fields.
      symbol: token.symbol || symbol,
      name: token.name || name,
      decimals,
      ...(iconUrl && /^https:\/\//i.test(iconUrl) ? { iconUrl: iconUrl.slice(0, 2048) } : {}),
      metadataStatus: "resolved",
      metadataUpdatedAt: now,
    };
  } catch {
    return { ...token, metadataStatus: "fallback", metadataUpdatedAt: now };
  }
}

async function mapConcurrent<T, R>(items: readonly T[], concurrency: number, worker: (item: T) => Promise<R>) {
  const output = new Array<R>(items.length);
  let cursor = 0;
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor++;
      output[index] = await worker(items[index]);
    }
  }));
  return output;
}

/**
 * Enrich the operator-controlled trusted registry with current on-chain display metadata.
 * Coin-type trust is never inferred from metadata, symbol, name, decimals or icon URL.
 */
export async function getHydratedTrustedTokenList(force = false) {
  const registryId = getTrustedTokenRegistryId();
  const cached = cache.get(registryId);
  if (!force && cached && cached.expiresAt > Date.now()) return cached.tokens;
  const tokens = await mapConcurrent(getTrustedTokenList(), MAX_CONCURRENCY, hydrateToken);
  cache.clear();
  cache.set(registryId, { expiresAt: Date.now() + TTL_MS, tokens });
  return tokens;
}
