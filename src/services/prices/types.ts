export type PriceProvider = "pyth" | "birdeye" | "coinmarketcap" | "coingecko";
export type PricePoint = {
  symbol: string;
  /** Canonical Sui coin type this quote was requested for, when applicable. */
  coinType?: string;
  priceUsd: number;
  provider: PriceProvider;
  updatedAt: number;
  confidence?: number;
  liquidityUsd?: number;
  change24h?: number;
};
export type PriceAsset = { symbol: string; coinType?: string; pythFeedId?: string; cmcId?: string; coingeckoId?: string };
