import "server-only";

import { cached } from "@/utils/cache";
import { getCoinMetadataGrpc } from "@/services/sui/grpc";
import { assertCoinType } from "@/services/sui/address";
import { asRecord, asString } from "@/services/sui/object-shapes";
import { AppError } from "@/utils/errors";

export type TradeAssetMetadata = {
  coinType: string;
  symbol: string;
  name: string;
  decimals: number;
};

const TRADE_METADATA_TTL_MS = 5 * 60_000;

function bounded(value: unknown, fallback: string, max: number) {
  const text = typeof value === "string" ? value.trim() : "";
  return text ? text.slice(0, max) : fallback;
}

/**
 * Resolve the denomination used for financial math directly from Sui metadata.
 * Browser-provided decimals are presentation hints only and must never determine
 * base-unit conversion, fee calculation, minimum output, or signed quote values.
 */
export async function resolveTradeAssetMetadata(rawCoinType: string): Promise<TradeAssetMetadata> {
  const coinType = assertCoinType(rawCoinType, "trade coin type");
  return cached(`trade-meta:${coinType}`, TRADE_METADATA_TTL_MS, async () => {
    const metadata = asRecord(await getCoinMetadataGrpc(coinType));
    if (!metadata) throw new AppError("UPSTREAM_ERROR", "Sui coin metadata is unavailable for this asset.", { status: 503 });

    const decimalsRaw = metadata.decimals;
    const decimals = typeof decimalsRaw === "number"
      ? decimalsRaw
      : typeof decimalsRaw === "string" && /^\d+$/.test(decimalsRaw)
        ? Number(decimalsRaw)
        : Number.NaN;
    if (!Number.isSafeInteger(decimals) || decimals < 0 || decimals > 18) {
      throw new AppError("UPSTREAM_ERROR", "Sui returned invalid token decimals for this asset.", { status: 503 });
    }

    const fallbackSymbol = coinType.split("::").at(-1)?.slice(0, 32) || "TOKEN";
    const symbol = bounded(asString(metadata.symbol), fallbackSymbol, 32).toUpperCase();
    const name = bounded(asString(metadata.name), symbol, 96);
    return { coinType, symbol, name, decimals };
  });
}
