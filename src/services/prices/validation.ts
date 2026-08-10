import "server-only";

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function finiteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function integerNumber(value: unknown): number | null {
  const number = finiteNumber(value);
  return number !== null && Number.isInteger(number) ? number : null;
}

export function parseBirdeyePayload(payload: unknown) {
  const root = asRecord(payload);
  const data = asRecord(root?.data);
  const value = finiteNumber(data?.value);
  if (root?.success !== true || value === null || value <= 0) return null;
  const updateUnixTime = integerNumber(data?.updateUnixTime);
  const liquidity = finiteNumber(data?.liquidity);
  return { value, updateUnixTime, liquidity: liquidity !== null && liquidity >= 0 ? liquidity : undefined };
}

export function parseCoinGeckoPayload(payload: unknown, coinId: string) {
  const root = asRecord(payload);
  const quote = asRecord(root?.[coinId]);
  const usd = finiteNumber(quote?.usd);
  if (usd === null || usd <= 0) return null;
  const change24h = finiteNumber(quote?.usd_24h_change);
  const lastUpdatedAt = integerNumber(quote?.last_updated_at);
  return { usd, change24h: change24h ?? undefined, lastUpdatedAt: lastUpdatedAt ?? undefined };
}

export function parsePythPayload(payload: unknown) {
  const root = asRecord(payload);
  if (!Array.isArray(root?.parsed) || !root.parsed.length) return null;
  const entry = asRecord(root.parsed[0]);
  const price = asRecord(entry?.price);
  const rawPrice = typeof price?.price === "string" && /^-?\d+$/.test(price.price) ? price.price : null;
  const rawConf = typeof price?.conf === "string" && /^\d+$/.test(price.conf) ? price.conf : null;
  const expo = integerNumber(price?.expo);
  const publishTime = integerNumber(price?.publish_time);
  if (!rawPrice || !rawConf || expo === null || publishTime === null) return null;
  const scale = 10 ** expo;
  const priceUsd = Number(rawPrice) * scale;
  const confidence = Number(rawConf) * scale;
  if (!Number.isFinite(priceUsd) || priceUsd <= 0 || !Number.isFinite(confidence) || confidence < 0) return null;
  return { priceUsd, confidence, publishTime };
}
