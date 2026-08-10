import "server-only";
import { cached } from "@/utils/cache";
import { getCoinMetadataGrpc } from "@/services/sui/grpc";
import { assertCoinType } from "@/services/sui/address";

export type DiscoveredToken = {
  coinType: string;
  symbol: string;
  name: string;
  decimals: number;
  iconUrl: string | null;
  verified: boolean;
};

type CoinMetadataLike = {
  decimals?: unknown;
  symbol?: unknown;
  name?: unknown;
  iconUrl?: unknown;
};

const META_TTL = 5 * 60_000;

export async function discoverToken(inputCoinType: string): Promise<DiscoveredToken> {
  const coinType = assertCoinType(inputCoinType, "coin type");
  return cached(`coin-meta:${coinType}`, META_TTL, async () => {
    const metadata = await getCoinMetadataGrpc(coinType) as CoinMetadataLike | null | undefined;
    const decimals = Number(metadata?.decimals);
    if (!metadata || !Number.isInteger(decimals) || decimals < 0 || decimals > 18) {
      return { coinType, symbol: "UNKNOWN", name: "Unknown token", decimals: 0, iconUrl: null, verified: false };
    }

    const symbol = typeof metadata.symbol === "string" && metadata.symbol.trim()
      ? metadata.symbol.trim().slice(0, 32)
      : "TOKEN";
    const name = typeof metadata.name === "string" && metadata.name.trim()
      ? metadata.name.trim().slice(0, 120)
      : symbol;

    return {
      coinType,
      symbol,
      name,
      decimals,
      iconUrl: typeof metadata.iconUrl === "string" && metadata.iconUrl.startsWith("https://") ? metadata.iconUrl : null,
      // RPC metadata is descriptive only. Verification comes from the trusted
      // registry / exact deployment coin-type mapping, never from metadata.
      verified: false,
    };
  });
}
